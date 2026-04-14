// 自定义 linter: 强制依赖边界规则
// 用法: bun run scripts/lint-dependencies.ts

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dir, '..')
const SRC = join(ROOT, 'src')

// 依赖规则: 每个层只能依赖前面的层
const LAYER_DEPS: Record<string, string[]> = {
  core: [],
  sqlite: ['core'],
  openviking: ['core'],
  embedder: ['core', 'utils'],
  queue: ['core', 'sqlite', 'openviking', 'embedder', 'utils'],
  tiered: ['core', 'sqlite', 'openviking', 'embedder', 'utils'],
  facts: ['core', 'sqlite', 'tiered', 'embedder', 'utils'],
  entity_tree: ['core', 'sqlite', 'facts', 'tiered', 'utils'],
  materials: ['core', 'sqlite', 'openviking', 'queue', 'embedder', 'utils'],
  llm: ['core', 'utils'],
  tools: ['core', 'sqlite', 'openviking', 'tiered', 'facts', 'entity_tree', 'materials', 'embedder', 'utils'],
  utils: ['core'],
}

// 入口文件允许的依赖
const ENTRY_DEPS = {
  'mcp_server.ts': ['tools', 'core', 'sqlite', 'utils', 'queue'],
}

function getLayer(filePath: string): string | null {
  const rel = relative(SRC, filePath)
  const parts = rel.split(/\\|\//)
  if (parts.length >= 2) {
    const layer = parts[0]
    if (layer in LAYER_DEPS) return layer
  }
  // 检查入口文件
  if (parts[0] === 'mcp_server.ts') return 'entry'
  return null
}

function getImports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const importRegex = /(?:import|require)\s*\(?['"]\.\/?([^'"]+)['"]\)?/g
    const imports: string[] = []
    let match
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      // 解析为相对于 src/ 的路径
      if (importPath.startsWith('.')) {
        const dir = filePath.replace(/\/[^/]+$/, '')
        const resolved = join(dir, importPath)
        const relFromSrc = relative(SRC, resolved)
        const layer = relFromSrc.split(/\\|\//)[0]
        if (layer && layer !== 'utils' && !layer.endsWith('.ts')) {
          imports.push(layer)
        }
      }
    }
    return [...new Set(imports)]
  } catch {
    return []
  }
}

function getAllSourceFiles(dir: string): string[] {
  const files: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...getAllSourceFiles(fullPath))
      }
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

function main() {
  const files = getAllSourceFiles(SRC)
  let hasErrors = false
  
  for (const file of files) {
    const layer = getLayer(file)
    if (!layer) continue
    
    const relPath = relative(ROOT, file).replace(/\\/g, '/')
    const imports = getImports(file)
    
    const allowedDeps = layer === 'entry' 
      ? ENTRY_DEPS['mcp_server.ts'] 
      : LAYER_DEPS[layer] || []
    
    for (const imp of imports) {
      if (!allowedDeps.includes(imp)) {
        console.error(
          `❌ ${relPath} (${layer}) → 不允许依赖 ${imp}\n` +
          `   允许: ${allowedDeps.join(', ') || '无'}`
        )
        hasErrors = true
      }
    }
  }
  
  if (hasErrors) {
    console.error('\n依赖边界检查失败! 请查看上方错误信息。')
    process.exit(1)
  } else {
    console.log('✅ 依赖边界检查通过')
  }
}

main()
