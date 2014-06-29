var osType = require('os').type();
var spawn = osType === 'Windows_NT' ? require('win-spawn') : require('child_process').spawn;

var fs = require('fs');
var path = require('path');


module.exports = function (runner, args, callback) {
  var be_verbose = !!args['v'];
  var compiler_dirname = runner.getConfigValue('closure-templates');

  if (!compiler_dirname) {
    return callback(new Error('Closure Templates path not specified'), null);
  }

  var jar_filename = path.join(compiler_dirname, 'SoyToJsSrcCompiler.jar');
  if (!fs.existsSync(jar_filename)) {
    return callback(
      new Error('Cannot find \033[0;31mClosure Templates\033[0m'),
      null
    );
  }

  var command = 'java';
  var command_args = [ '-jar', jar_filename ];

  callback(null, function (flags, callback) {
    for (var key in flags) {
      var value = flags[key];
      if (Array.isArray(value)) {
        value.forEach(function (val) {
          command_args.push('--' + key, val);
        });
      } else {
        command_args.push('--' + key);
        if (value !== true) {
          command_args.push(value);
        }
      }
    }

    if (be_verbose) {
      runner.log('Compilation command:\n\033[2;38m');
      runner.log(command + ' \\\n  ');
      runner.log(command_args.join(' \\\n  ') + '\033[0m\n');
    }

    child(command, command_args, function (err, result) {
      if (err || result.stderr) {
        callback(err || new Error(result.stderr));
      } else {
        callback(null);
      }
    });
  });
};


function child(command, args, callback) {
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
}
