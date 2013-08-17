var optimist = require('optimist');
var path = require('path');


var Environment = function (env_vars) {
  this.env_vars_ = env_vars;

  this.raw_args_ = [];
  this.args_ = null;
  this.config_ = {};
  this.main_task_id_ = null;

  this.reset();
};


Environment.prototype.reset = function () {
  this.apps_ = {};
  this.arg_rules_ = {};
  this.externs_ = {};
  this.compiler_flags_ = {};
  this.tasks_ = {};
};


Environment.prototype.setArguments = function (argv) {
  this.raw_args_ = argv.slice();
  this.updateArguments();
};


Environment.prototype.updateArguments = function () {
  var args = optimist(this.raw_args_);

  var arg_rules = this.arg_rules_;
  for (var arg_key in arg_rules) {
    var arg_rule = arg_rules[arg_key];
    args[arg_rule].call(args, arg_key);
  }

  this.args_ = args.argv;

  this.main_task_id_ = this.args_._[0] || this.get('default-task');
};


Environment.prototype.getArguments = function () {
  var result = {};
  var args = this.args_;

  for (var key in args) {
    result[key] = args[key];
  }

  return result;
};


Environment.prototype.addConfig = function (config_path) {
  var config = require(config_path);
  config.__proto__ = this.config_;

  this.config_ = config;

  this.update();
};


Environment.prototype.getConfig = function () {
  var config = {};

  for (var key in this.config_) {
    config[key] = this.get(key);
  }

  return config;
};


Environment.prototype.update = function () {
  this.reset();

  for (var key in this.config_) {
    if (/^apps\./.test(key)) {
      var app = this.get(key);
      app['id'] = key.replace(/^apps\./, '');
      this.apps_[app['id']] = app;
    }
    if (/^args\./.test(key)) {
      this.arg_rules_[key.replace(/^args\./, '')] = String(this.get(key));
    }
    if (/^closure-compiler\.flags\./.test(key)) {
      var flag = key.replace(/^closure-compiler\.flags\./, '');
      this.compiler_flags_[flag] = String(this.get(key));
    }
    if (/^externs\./.test(key)) {
      this.externs_[key.replace(/^externs\./, '')] = String(this.get(key));
    }
    if (/^tasks\./.test(key)) {
      var task_id = key.replace(/^tasks\./, '').replace(/_$/, '');
      this.tasks_[task_id] = {
        filename: this.get(key),
        shadow: /_$/.test(key)
      };
    }
  }

  if (this.has('app')) {
    this.apps_['app'] = this.get('app');
  }

  for (var app_id in this.apps_) {
    this.consolidateApp_(this.apps_[app_id]);
  }

  this.updateArguments();
};


Environment.prototype.consolidateApp_ = function (app) {
  var externs = {};
  var compiler_flags = {};

  for (var key in app) {
    if (/^externs\./.test(key)) {
      externs[key.replace(/^externs\./, '')] = app[key];
      delete app[key];
    }
    if (/^closure-compiler\.flags\./.test(key)) {
      compiler_flags[key.replace(/^closure-compiler\.flags\./, '')] = app[key];
      delete app[key];
    }
  }

  for (var extern in this.externs_) {
    externs[extern] = externs[extern] || this.externs_[extern];
  }
  for (var flag in this.compiler_flags_) {
    compiler_flags[flag] = compiler_flags[flag] || this.flags_[flag];
  }

  app['externs'] = externs;
  app['closure-compiler.flags'] = compiler_flags;
};


Environment.prototype.get = function (key) {
  return this.has(key) ? this.config_[key] : null;
};


Environment.prototype.has = function (key) {
  return (key in this.config_);
};


Environment.prototype.getVariable = function (key) {
  return (key in this.env_vars_) ? this.env_vars_[key] : null;
};


Environment.prototype.getProjectDirname = function () {
  return this.getVariable('PWD');
};


Environment.prototype.setMainTaskId = function (task_id) {
  this.main_task_id_ = task_id || null;
};


Environment.prototype.getMainTaskId = function () {
  return this.main_task_id_;
};


Environment.prototype.getApps = function () {
  var apps = this.apps_;
  var result = [];

  for (var key in apps) {
    result.push(apps[key]);
  }

  return result;
};


Environment.prototype.getTasks = function () {
  var tasks = this.tasks_;
  var result = {};

  for (var key in tasks) {
    result[key] = {
      filename: tasks[key].filename,
      shadow: tasks[key].shadow
    };
  }

  return result;
};


module.exports = Environment;
