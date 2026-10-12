import { login } from '../login.js'

export default async ({ opts, args }) => {
  process.stderr.write((await login(args[0], opts)) + '\n')
}
