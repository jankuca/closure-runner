var async = require('async');
var path = require('path');


var Runner = require('./lib/runner');
var Environment = require('./lib/environment');
var ProcessOutput = require('./lib/process-output');


function main(callback) {
  var env = new Environment(process.env);
  var stderr = new ProcessOutput(process.stderr);

  env.addConfig(path.join(__dirname, './client.defaults.json'));
  env.addConfig(path.join(env.getProjectDirname(), './client.json'));
  env.setArguments(process.argv.slice(2));

  async.map(env.getApps(), function (app, callback) {
    var args = env.getArguments();
    var runner = new Runner(app, args, stderr);

    runner.setProjectDirname(env.getProjectDirname());
    runner.setClosureCompilerDirname(env.get('closure-compiler'));
    runner.setClosureLibraryDirname(env.get('closure-library'));
    runner.setTasks(env.getTasks());

    runner.runTask(env.getMainTaskId(), callback);
  }, exit);
}


function exit(err) {
  process.stderr.write('\n');
  if (err) {
    process.exit(1);
  }
}


if (require.main === module) {
  main(exit);
} else {
  exports.Environment = Environment;
  exports.ProcessOutput = ProcessOutput;
  exports.Runner = Runner;

  exports.main = main.bind(null, exit);
  exports.run = main.bind(null);
}
