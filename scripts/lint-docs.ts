// 文档检查 linter: 验证知识库完整性
// 用法: bun run scripts/lint-docs.ts

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dir, '..')
const DOCS = join(ROOT, 'docs')

interface DocIssue {
  file: string
  message: string
  severity: 'error' | 'warning'
}

const issues: DocIssue[] = []

function checkFileExists(filePath: string, context: string) {
  if (!existsSync(filePath)) {
    issues.push({
      file: context,
      message: `引用不存在的文件: ${relative(ROOT, filePath)}`,
      severity: 'warning'
    })
  }
}

function checkMarkdownLinks(file: string, content: string) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match
  
  while ((match = linkRegex.exec(content)) !== null) {
    const [full, text, url] = match
    
    // 跳过锚点链接
    if (url.startsWith('#')) continue
    
    // 检查相对链接
    if (url.startsWith('.') || url.startsWith('../')) {
      const lastSlash = Math.max(file.lastIndexOf('\\'), file.lastIndexOf('/'))
      const dir = lastSlash !== -1 ? file.substring(0, lastSlash + 1) : ''
      const urlWithoutAnchor = url.replace(/#.*/, '')
      const resolved = join(dir, urlWithoutAnchor).replace(/\\/g, '/')
      
      // 检查文件是否存在
      if (urlWithoutAnchor.endsWith('.md') || (!url.includes('#') && !urlWithoutAnchor.includes('/'))) {
        // resolved 已经是绝对路径，直接检查
        if (!existsSync(resolved)) {
          issues.push({
            file: relative(ROOT, file),
            message: `链接可能失效: ${url}`,
            severity: 'warning'
          })
        }
      }
    }
  }
}

function checkDocIndex(indexFile: string) {
  if (!existsSync(indexFile)) {
    issues.push({
      file: 'docs/',
      message: `缺少索引文件: ${relative(ROOT, indexFile)}`,
      severity: 'error'
    })
    return
  }
  
  const content = readFileSync(indexFile, 'utf-8')
  checkMarkdownLinks(indexFile, content)
  
  // 检查索引是否包含必要的表格/列表
  if (!content.includes('|') && !content.includes('- [')) {
    issues.push({
      file: relative(ROOT, indexFile),
      message: '索引文件应该包含文档列表',
      severity: 'warning'
    })
  }
}

function scanDocs() {
  // 检查必需的索引文件
  checkDocIndex(join(DOCS, 'design-docs', 'index.md'))
  checkDocIndex(join(DOCS, 'references', 'index.md'))
  checkDocIndex(join(DOCS, 'generated', 'index.md'))
  
  // 检查 AGENTS.md 是否是简洁的 (约100行)
  const agentsMd = join(ROOT, 'AGENTS.md')
  if (existsSync(agentsMd)) {
    const content = readFileSync(agentsMd, 'utf-8')
    const lines = content.split('\n').length
    if (lines > 150) {
      issues.push({
        file: 'AGENTS.md',
        message: `AGENTS.md 有 ${lines} 行，应该保持在约 100 行`,
        severity: 'warning'
      })
    }
  }
  
  // 扫描所有 markdown 文件检查死链接
  function scanDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist') {
          scanDir(fullPath)
        }
      } else if (entry.name.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8')
        checkMarkdownLinks(fullPath, content)
        
        // 检查是否包含状态标记
        if (fullPath.includes('design-docs') && fullPath.endsWith('index.md')) {
          // 索引文件应该有状态
        }
      }
    }
  }
  
  scanDir(DOCS)
}

function main() {
  scanDocs()
  
  if (issues.length === 0) {
    console.log('✅ 文档检查通过')
    return
  }
  
  let hasErrors = false
  for (const issue of issues) {
    const prefix = issue.severity === 'error' ? '❌' : '⚠️'
    console.log(`${prefix} ${issue.file}: ${issue.message}`)
    if (issue.severity === 'error') hasErrors = true
  }
  
  console.log(`\n发现 ${issues.length} 个问题 (${issues.filter(i => i.severity === 'error').length} errors)`)
  if (hasErrors) {
    process.exit(1)
  }
}

main()
