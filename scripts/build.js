// build.mjs
import { fileURLToPath } from 'url'
import fs from 'fs'
import path from 'path'
import concurrently from 'concurrently'

// __dirname, __filename 대체
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 루트 디렉토리 및 _solutions 디렉토리 설정
const ROOT_DIR = path.resolve(__dirname, '../')
const SOLUTIONS_DIR = path.resolve(__dirname, '../_solutions')
const SOLUTIONS_DIR_FROM_ROOT = SOLUTIONS_DIR.replace(ROOT_DIR, './')

// 문제 디렉토리 목록 가져오기
const PROBLEM_DIRS = fs
  .readdirSync(SOLUTIONS_DIR)
  .map(name => path.join(SOLUTIONS_DIR_FROM_ROOT, name))
  .filter(dir => fs.lstatSync(dir).isDirectory())

// package.json 재생성
const oldPackageJson = path.resolve(__dirname, '../package.json')
let packageJson = {}
const exportsField = {}

PROBLEM_DIRS.forEach(dir => {
  // bunchee 빌드 시 사용할 때는 단순 폴더명만 필요
  const dirName = path.basename(dir)

  // cjs, mjs 출력 경로
  const cjs = path.join(
    SOLUTIONS_DIR_FROM_ROOT,
    dirName,
    `${dirName}.answer.cjs`
  )
  const mjs = path.join(
    SOLUTIONS_DIR_FROM_ROOT,
    dirName,
    `${dirName}.answer.mjs`
  )

  // package.json exports 필드
  exportsField[`./${dirName}`] = {
    require: `./${cjs}`,
    // 필요하다면 mjs도 함께 지정 가능
    // import: `./${mjs}`,
  }
})

if (oldPackageJson) {
  try {
    packageJson = JSON.parse(fs.readFileSync(oldPackageJson, 'utf-8'))
    packageJson.exports = exportsField
    fs.writeFileSync(
      oldPackageJson,
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    )
  } catch (e) {
    console.warn(e)
    console.warn('package.json 유실')
  }
}

// 빌드 명령어 구성
const commands = PROBLEM_DIRS.map(dir => {
  const dirName = path.basename(dir)
  const outFile = path.join(dir, `${dirName}.answer.cjs`)

  // solution.js → solution.ts 순으로 엔트리 파일 검색
  let entryFile = path.join(dir, 'solution.js')
  if (!fs.existsSync(entryFile)) {
    entryFile = path.join(dir, 'solution.ts')
  }
  if (!fs.existsSync(entryFile)) {
    console.warn(dir, '번 문제에 풀이가 없습니다')
    return null
  }

  // bunchee 빌드커맨드 생성
  return {
    command: [
      'bunchee',
      `"${entryFile}"`,
      `--outFile "${outFile}"`,
      '-f cjs', // 백준이 cjs만 받음
      '--no-external', // 모든 의존성 포함
    ].join(' '),
    name: dirName,
  }
})

// 병렬 실행
const valids = commands.filter(Boolean)
const { result } = concurrently(valids, {
  prefix: 'name',
  killOthers: ['failure'],
})

result.then(
  () => console.log('----------------- 😇DONE😇 -----------------'),
  () => console.warn('----------------- ERR!!!! -----------------')
)

// 순차 실행 (필요 시 사용)
// commands.forEach(cmd => {
//   if (!cmd) {
//     console.warn(`solution.js / solution.ts 파일을 찾지 못했습니다.`)
//     return
//   }
//   execSync(cmd.command, { stdio: 'inherit' })
// })
