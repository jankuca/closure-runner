var spawn = require('win-spawn');


module.exports = function child(command, args, callback) {
  var result = {
    stdout: '',
    stderr: '',
    code: null
  };

  var proc = spawn(command, args);

  proc.stdout.on('data', function (chunk) {
    result.stdout += chunk;
  });
  proc.stderr.on('data', function (chunk) {
    result.stderr += chunk;
  });
  proc.on('close', function (code) {
    setTimeout(function () {
      result.code = code || 0;
      callback(null, result);
    }, 0);
  });
  proc.on('error', function (err) {
    callback(err, result);
  });
};
