const readline = require('readline');

/**
 * Prompt the user for a password without echoing it to the terminal.
 * Works cross-platform without external dependencies.
 */
function promptPassword(question = 'PDF password: ') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.stdin;
    let muted = false;

    // Intercept writes to stdout to hide typed characters
    const originalWrite = rl._writeToOutput;
    rl._writeToOutput = function (stringToWrite) {
      if (muted) {
        // Only show the prompt itself, mask everything else
        if (stringToWrite.trim() === question.trim()) {
          rl.output.write(stringToWrite);
        } else {
          rl.output.write('');
        }
      } else {
        rl.output.write(stringToWrite);
      }
    };

    rl.question(question, (answer) => {
      rl.history = rl.history.slice(1);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });

    muted = true;
  });
}

module.exports = { promptPassword };
