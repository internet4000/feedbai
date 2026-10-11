/** Read one line from the terminal without echoing it (or from piped stdin). */
export const promptHidden = (question) =>
  new Promise((resolve, reject) => {
    const { stdin, stderr } = process
    stderr.write(question)
    let value = ''
    if (!stdin.isTTY) {
      stdin.setEncoding('utf8')
      stdin.on('data', (chunk) => (value += chunk))
      stdin.on('end', () => resolve(value.split('\n')[0].trim()))
      return
    }
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    const done = (fn) => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off('data', onData)
      stderr.write('\n')
      fn()
    }
    const onData = (char) => {
      if (char === '\r' || char === '\n') done(() => resolve(value))
      else if (char === '\u0003') done(() => reject(new Error('cancelled')))
      else if (char === '\u007f') value = value.slice(0, -1)
      else value += char
    }
    stdin.on('data', onData)
  })
