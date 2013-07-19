var child_process = require('child_process');
var fs = require('fs');
var path = require('path');


module.exports = function (runner, args, callback) {
  var be_verbose = !!args['v'];
  var library_dirname = runner.getConfigValue('closure-library');

  if (!library_dirname) {
    return callback(new Error('Closure Library path not specified'), null);
  }

  var depswriter_filename = path.join(
    library_dirname, 'closure', 'bin', 'build', 'depswriter.py'
  );
  if (!fs.existsSync(depswriter_filename)) {
    return callback(
      new Error('Cannot find \033[0;31mClosure Library DepsWriter\033[0m'),
      null
    );
  }
  if (!isExecutable(depswriter_filename)) {
    try {
      fs.chmodSync(depswriter_filename, '+x');
    } catch (err) {
      return callback(
        new Error(
          '\033[0;31mClosure Library DepsWriter\033[0m is not executable' +
          'and automatic chmod +x failed.'
        ),
        null
      );
    }

    return callback(
      new Error('\033[0;31mClosure Library DepsWriter\033[0m is not executable'),
      null
    );
  }

  var command = depswriter_filename;
  var command_args = [];

  callback(null, function (flags, callback) {
    for (var key in flags) {
      var value = flags[key];
      if (Array.isArray(value)) {
        value.forEach(function (val) {
          command_args.push('--' + key + '=' + val);
        });
      } else {
        command_args.push('--' + key + '=' + value);
      }
    }

    if (be_verbose) {
      runner.log('DepsWriter command:\n\033[2;38m');
      runner.log(command + ' \\\n  ');
      runner.log(command_args.join(' \\\n  ') + '\033[0m\n');
    }

    child(command, command_args, function (err, result) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, result.stdout);
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

  var proc = child_process.spawn(command, args);

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


function checkPermission(file, mask) {
  var stat = fs.statSync(file);
  var perms = parseInt((stat.mode & parseInt("777", 8)).toString(8)[0]);
  return !!(mask & perms);
}


function isExecutable(file) {
  return checkPermission(file, 1);
}

