// Doc-gardener: 扫描过时文档并发起修复建议
// 用法: bun run scripts/doc-gardener.ts
//
// 功能:
// 1. 扫描 docs/ 中所有 markdown 文件
// 2. 检查文档中的代码引用是否仍然有效
// 3. 检查文档描述的行为是否与代码一致
// 4. 输出需要更新的文档列表

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dir, '..')
const DOCS = join(ROOT, 'docs')
const SRC = join(ROOT, 'src')

interface DocIssue {
  file: string
  issue: string
  suggestion: string
  severity: 'error' | 'warning'
}

const issues: DocIssue[] = []

// 检查文件是否存在
function checkFileExists(path: string, context: string) {
  if (!existsSync(path)) {
    issues.push({
      file: context,
      issue: `引用不存在的文件: ${path}`,
      suggestion: '更新链接或删除引用',
      severity: 'warning'
    })
  }
}

// 检查代码引用
function checkCodeReferences(file: string, content: string) {
  // 匹配代码块中的文件路径
  const pathRegex = /`(?:src\/[^`]+)`/g
  let match
  
  while ((match = pathRegex.exec(content)) !== null) {
    const path = match[0].replace(/`/g, '')
    const fullPath = join(ROOT, path)
    if (!existsSync(fullPath)) {
      issues.push({
        file: relative(ROOT, file),
        issue: `代码引用失效: ${path}`,
        suggestion: '验证路径或更新文档',
        severity: 'warning'
      })
    }
  }
  
  // 匹配 import 语句
  const importRegex = /import\s+.*?from\s+['"]\.\/?([^'"]+)['"]/g
  while ((match = importRegex.exec(content)) !== null) {
    // 文档中的 import 示例，仅做记录
  }
}

// 检查文档新鲜度
function checkDocFreshness(file: string, content: string) {
  // 检查是否有最后更新日期
  const dateRegex = /(\d{4}-\d{2}-\d{2})/
  const match = content.match(dateRegex)
  
  if (!match) {
    issues.push({
      file: relative(ROOT, file),
      issue: '缺少更新日期',
      suggestion: '添加最后更新日期标记',
      severity: 'warning'
    })
  } else {
    const docDate = new Date(match[1])
    const now = new Date()
    const daysOld = Math.floor((now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysOld > 90) {
      issues.push({
        file: relative(ROOT, file),
        issue: `文档已超过 90 天 (${daysOld} 天)`,
        suggestion: '审查并更新文档',
        severity: 'warning'
      })
    }
  }
}

// 检查状态标记
function checkStatusMarkers(file: string, content: string) {
  // 设计文档应该有状态标记
  if (file.includes('design-docs') && file.endsWith('.md')) {
    if (!content.includes('status:') && !content.includes('状态:')) {
      issues.push({
        file: relative(ROOT, file),
        issue: '缺少状态标记',
        suggestion: '添加 status: active|deprecated|draft',
        severity: 'warning'
      })
    }
  }
}

// 检查文档与代码的一致性
function checkDocCodeConsistency(file: string, content: string) {
  // 检查文档中提到的 API 端点是否在代码中存在
  const apiRegex = /\/api\/v1\/[a-zA-Z0-9_/]+/g
  let match
  
  const mentionedApis = new Set<string>()
  while ((match = apiRegex.exec(content)) !== null) {
    mentionedApis.add(match[0])
  }
  
  // 扫描代码中的实际 API 端点
  const actualApis = new Set<string>()
  function scanSource(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist') {
          scanSource(fullPath)
        }
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const srcContent = readFileSync(fullPath, 'utf-8')
        const apiMatches = srcContent.match(apiRegex)
        if (apiMatches) {
          apiMatches.forEach(api => actualApis.add(api))
        }
      }
    }
  }
  
  try {
    scanSource(SRC)
  } catch {
    // 忽略扫描错误
  }
  
  // 检查提到的 API 是否存在
  for (const api of mentionedApis) {
    if (!actualApis.has(api)) {
      issues.push({
        file: relative(ROOT, file),
        issue: `文档提到 ${api} 但代码中未找到`,
        suggestion: '验证 API 是否已删除或文档过时',
        severity: 'warning'
      })
    }
  }
}

// 扫描文档
function scanDocs() {
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
        checkCodeReferences(fullPath, content)
        checkDocFreshness(fullPath, content)
        checkStatusMarkers(fullPath, content)
        checkDocCodeConsistency(fullPath, content)
      }
    }
  }
  
  scanDir(DOCS)
  
  // 也检查 AGENTS.md
  const agentsMd = join(ROOT, 'AGENTS.md')
  if (existsSync(agentsMd)) {
    const content = readFileSync(agentsMd, 'utf-8')
    checkDocFreshness(agentsMd, content)
  }
}

// 生成报告
function generateReport() {
  if (issues.length === 0) {
    console.log('✅ Doc-gardener: 文档健康')
    return
  }
  
  console.log(`📊 Doc-gardener 报告 (${issues.length} 个问题)\n`)
  
  for (const issue of issues) {
    const prefix = issue.severity === 'error' ? '❌' : '⚠️'
    console.log(`${prefix} ${issue.file}`)
    console.log(`   问题: ${issue.issue}`)
    console.log(`   建议: ${issue.suggestion}\n`)
  }
  
  // 生成修复计划
  const planPath = join(DOCS, 'exec-plans', 'active', 'doc-garden-plan.md')
  let plan = `# 文档修复计划\n\n**生成**: ${new Date().toISOString().split('T')[0]}\n\n`
  plan += `发现 ${issues.length} 个问题\n\n`
  plan += '## 待修复\n\n'
  
  for (const issue of issues) {
    plan += `- [ ] **${issue.file}**: ${issue.issue}\n`
    plan += `    → ${issue.suggestion}\n`
  }
  
  writeFileSync(planPath, plan)
  console.log(`📝 修复计划已生成: ${relative(ROOT, planPath)}`)
}

function main() {
  scanDocs()
  generateReport()
}

main()
