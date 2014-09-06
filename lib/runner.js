var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var rmrf = require('rimraf');


var Runner = function (app, args, stderr) {
  this.app_ = app;
  this.args_ = args || { _: [] };
  this.stderr = stderr || new ProcessOutput(process.stderr);

  this.project_dirname_ = null;
  this.stack_dirname_ = path.resolve(__dirname, '..');

  this.config_ = {};
  this.tasks_ = {};
  this.running_tasks_ = [];
};


Runner.prototype.setConfig = function (config) {
  this.config_ = {};

  if (config) {
    for (var key in config) {
      this.config_[key] = config[key];
    }
  }
};


Runner.prototype.getConfigValue = function (key) {
  var value = this.config_[key];
  return (typeof value === 'undefined') ? null : value;
};


Runner.prototype.getAppConfigValue = function (key) {
  var value = this.app_[key];
  return (typeof value === 'undefined') ? null : value;
};


Runner.prototype.getStackDirname = function () {
  return this.stack_dirname_;
};


Runner.prototype.getTempDirname = function () {
  var temp_dirname = this.getAppConfigValue('output.sources');
  temp_dirname = temp_dirname || path.join(this.getStackDirname(), 'temp');

  if (!fs.existsSync(temp_dirname)) {
    mkdirp.sync(temp_dirname);
  }

  return temp_dirname;
};


Runner.prototype.setProjectDirname = function (project_dirname) {
  this.project_dirname_ = project_dirname || null;
};


Runner.prototype.getProjectDirname = function () {
  return this.project_dirname_;
};


Runner.prototype.setSourceMapPath = function (source_map_path) {
  this.source_map_path_ = source_map_path || null;
};


Runner.prototype.getSourceMapPath = function () {
  return this.source_map_path_ ? this.path(this.source_map_path_) : null;
};


Runner.prototype.setOutputPath = function (output_path) {
  this.output_path_ = output_path || null;
};


Runner.prototype.getOutputPath = function () {
  return this.path(this.output_path_);
};


Runner.prototype.addAppNamespace = function (ns) {
  if (this.app_namespaces_.indexOf(ns) === -1) {
    this.app_namespaces_.push(ns);
  }
};


Runner.prototype.getAppNamespaces = function () {
  return this.app_namespaces_.slice();
};


Runner.prototype.addRoot = function (root) {
  if (this.roots_.indexOf(root) === -1) {
    this.roots_.push(root);
  }
};


Runner.prototype.getRoots = function () {
  return this.roots_.slice();
};


Runner.prototype.setTasks = function (tasks) {
  this.tasks_ = tasks;
};


Runner.prototype.getExterns = function () {
  var externs = {};
  for (var extern_id in this.externs_) {
    externs[extern_id] = this.path(this.externs_[extern_id]);
  }

  return externs;
};


Runner.prototype.path = function (filename) {
  var runner_dirname = this.stack_dirname_;
  filename = filename.replace('{runner_dirname}', runner_dirname);

  var is_absolute = (filename[0] === '/');
  if (path.sep !== '/') {
    is_absolute = /^[a-zA-Z]:\\/.test(filename);
  }

  if (is_absolute) {
    filename = '.' + path.sep + path.relative(this.project_dirname_, filename);
  }

  return filename;
};


Runner.prototype.log = function (chunk) {
  this.stderr.write(chunk);
};


Runner.prototype.getTask_ = function (task_id) {
  var task_desc = this.tasks_[task_id];
  if (!task_desc) {
    return null;
  }

  var task = {};
  task.id = task_id;
  task.filename = this.path(task_desc.filename);
  task.shadow = task_desc.shadow;

  var stack_to_project = path.relative(this.stack_dirname_, this.project_dirname_);
  var run = require(path.join(this.stack_dirname_, stack_to_project, task.filename));
  task.run = run.bind(null, this, this.args_);

  return task;
};


Runner.prototype.runMainTask = function (task_id, callback) {
  var task = this.getTask_(task_id);
  if (!task) {
    callback(new Error('Unknown task \033[0;31m' + task_id + '\033[0m'));
  } else if (task.shadow) {
    callback(new Error('Cannot run a shadow task directly'));

  } else {
    this.resetTemp_();

    if (this.app_['id']) {
      this.stderr.write('\033[2;37mBuilding app \033[2;1;37m' + this.app_['id']);
      this.stderr.write('\033[0m\n');
    } else {
      this.stderr.write('\033[2;37mBuilding app\033[0m\n');
    }

    this.runTask_(task, callback);
  }
};


Runner.prototype.runTask = function (task_id, callback) {
  var task = this.getTask_(task_id);
  if (!task) {
    callback(new Error('Unknown task \033[0;31m' + task_id + '\033[0m'));
  } else {
    this.runTask_(task, callback);
  }
};


Runner.prototype.runTasks = function (task_ids, callback) {
  var self = this;
  var onTask = function (task_id, callback) {
    self.runTask(task_id, callback);
  };

  async.eachSeries(task_ids, onTask, callback);
};


Runner.prototype.runTask_ = function (task, callback) {
  var stderr = this.stderr;
  var running_tasks = this.running_tasks_;
  var be_verbose = !!this.args_['v'];

  if (be_verbose || running_tasks.length === 0 || !task.shadow) {
    stderr.write('\033[4;36mRunning task ');
    stderr.write('\033[4;1;36m' + task.id + '\033[0m\n');
    stderr.indent();
  }

  running_tasks.push(task.id);

  task.run(function (err) {
    running_tasks.pop();

    if (be_verbose || running_tasks.length === 0 || !task.shadow) {
      if (!err) {
        stderr.outdent();
        stderr.write('\033[0;32mok\033[0m\n');
      }
    }

    if (err) {
      callback(err);
    } else {
      callback.apply(null, arguments);
    }
  });
};


Runner.prototype.resetTemp_ = function () {
  var temp_dirname = this.getTempDirname();
  rmrf.sync(temp_dirname)
  mkdirp.sync(temp_dirname);
};


module.exports = Runner;
