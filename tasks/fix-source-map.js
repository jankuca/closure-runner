var fs = require('fs');
var path = require('path');


module.exports = function (runner, args, callback) {
  var be_verbose = args['v'];

  var project_dirname = runner.getProjectDirname();
  var source_map_path = runner.getAppConfigValue('output.source-map');
  var source_map_dirname = path.dirname(source_map_path);

  if (be_verbose) {
    runner.log('Fixing source map: ' + source_map_path + '\n');
  }

  fs.readFile(source_map_path, 'utf8', function (err, json) {
    if (err) return callback(err);

    var map = JSON.parse(json);

    map['sources'] = map['sources'].map(function (source) {
      var source_absolute = path.resolve(project_dirname, source);
      var rel = path.relative(source_map_dirname, source_absolute);
      return '../' + source.substr(root.length);
    });

    json = JSON.stringify(map);
    fs.writeFile(source_map_path, json, 'utf8', callback);
  });
};
