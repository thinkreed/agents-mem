// 夜间巡检脚本：综合检查项目健康度
// 用法: bun run scripts/nightly-audit.ts
// 输出: docs/exec-plans/active/nightly-audit-YYYY-MM-DD.md

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, relative } from 'path'
import { execSync } from 'child_process'

const ROOT = join(import.meta.dir, '..')
const EXEC_PLANS = join(ROOT, 'docs', 'exec-plans', 'active')
const DATE = new Date().toISOString().split('T')[0]
const REPORT_FILE = join(EXEC_PLANS, `nightly-audit-${DATE}.md`)

interface AuditResult {
  check: string
  status: 'pass' | 'fail' | 'warn'
  output: string
}

const results: AuditResult[] = []

function runCheck(name: string, cmd: string): AuditResult {
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 120000 })
    const trimmed = output.trim()
    
    if (trimmed.includes('✅') || trimmed.includes('passed') || !trimmed.includes('error')) {
      return { check: name, status: 'pass', output: trimmed }
    } else if (trimmed.includes('⚠') || trimmed.includes('warning')) {
      return { check: name, status: 'warn', output: trimmed }
    } else {
      return { check: name, status: 'fail', output: trimmed }
    }
  } catch (error: any) {
    return { 
      check: name, 
      status: 'fail', 
      output: error.stdout?.toString() || error.message 
    }
  }
}

function generateReport() {
  const now = new Date().toISOString()
  let report = `# 夜间巡检报告 — ${DATE}\n\n`
  report += `**执行时间**: ${now}\n`
  report += `**分支**: main\n\n`
  
  report += '## 检查结果\n\n'
  report += '| 检查项 | 状态 |\n'
  report += '|--------|------|\n'
  
  let passCount = 0
  let failCount = 0
  let warnCount = 0
  
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌'
    report += `| ${result.check} | ${icon} |\n`
    if (result.status === 'pass') passCount++
    else if (result.status === 'fail') failCount++
    else warnCount++
  }
  
  report += `\n**总计**: ${passCount} 通过, ${warnCount} 警告, ${failCount} 失败\n\n`
  
  // 详细输出
  report += '## 详细信息\n\n'
  for (const result of results) {
    report += `### ${result.check} [${result.status.toUpperCase()}]\n\n`
    report += '```\n'
    report += result.output.split('\n').slice(0, 20).join('\n') // 最多 20 行
    report += '\n```\n\n'
  }
  
  // 自动修复建议
  report += '## 自动修复建议\n\n'
  const failed = results.filter(r => r.status === 'fail')
  const warned = results.filter(r => r.status === 'warn')
  
  if (failed.length === 0 && warned.length === 0) {
    report += '✅ 所有检查通过，无需修复\n'
  } else {
    if (failed.length > 0) {
      report += '### 需要立即修复\n\n'
      for (const r of failed) {
        report += `- ❌ **${r.check}**\n`
        report += `  ${getFixSuggestion(r)}\n`
      }
      report += '\n'
    }
    if (warned.length > 0) {
      report += '### 建议关注\n\n'
      for (const r of warned) {
        report += `- ⚠️ **${r.check}**\n`
        report += `  ${getFixSuggestion(r)}\n`
      }
      report += '\n'
    }
  }
  
  // 文档花园报告
  report += generateDocGardenReport()
  
  writeFileSync(REPORT_FILE, report, 'utf-8')
  console.log(`📝 报告已生成: ${relative(ROOT, REPORT_FILE)}`)
  console.log(`📊 结果: ${passCount} 通过, ${warnCount} 警告, ${failCount} 失败`)
  
  // 返回退出码 (如果有失败则返回 1)
  return failed.length > 0 ? 1 : 0
}

function getFixSuggestion(result: AuditResult): string {
  if (result.check.includes('依赖')) {
    return '运行 `bun run lint:deps` 查看违规依赖并修复'
  } else if (result.check.includes('文档')) {
    return '运行 `bun run lint:docs` 查看失效链接并修复'
  } else if (result.check.includes('类型')) {
    return '运行 `bun run typecheck` 修复类型错误'
  } else if (result.check.includes('测试')) {
    return '运行 `bun test` 查看失败测试并修复'
  }
  return '检查日志并手动修复'
}

function generateDocGardenReport(): string {
  let report = '## 文档花园报告\n\n'
  
  try {
    const gardenOutput = execSync('bun run scripts/doc-gardener.ts', { 
      cwd: ROOT, 
      encoding: 'utf-8', 
      timeout: 60000 
    })
    
    const issueCount = (gardenOutput.match(/问题/g) || []).length
    report += `发现 ${issueCount} 个文档问题\n\n`
    
    if (issueCount === 0) {
      report += '✅ 文档健康\n'
    } else {
      report += '详见: `docs/exec-plans/active/doc-garden-plan.md`\n'
    }
  } catch {
    report += '⚠️ 文档花园检查失败\n'
  }
  
  return report
}

function main() {
  console.log('🌙 夜间巡检开始...\n')
  
  // 1. 依赖边界检查
  console.log('1/4 检查依赖边界...')
  results.push(runCheck('依赖边界', 'bun run scripts/lint-dependencies.ts'))
  
  // 2. 文档检查
  console.log('2/4 检查文档...')
  results.push(runCheck('文档', 'bun run scripts/lint-docs.ts'))
  
  // 3. 类型检查
  console.log('3/4 检查类型...')
  results.push(runCheck('类型', 'bun run typecheck'))
  
  // 4. 测试
  console.log('4/4 运行测试...')
  results.push(runCheck('测试', 'bun test'))
  
  // 生成报告
  const exitCode = generateReport()
  
  console.log('\n✅ 夜间巡检完成')
  process.exit(exitCode)
}

main()
