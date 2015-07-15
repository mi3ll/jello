module.exports = function (gulp, $, $env) {
    var $defaults = require("../lib/defaults")(gulp, $, $env),
        $helpers = require("../lib/helpers")(gulp, $, $env),
        watchFiles = {
            'assets.json':   ['reconfigure'],
            'bower.json':    ['install:bower'],
            'composer.json': ['update:composer'],
            'package.json':  ['install:npm']
        },
        watchTasks = {
            'css':     ['build:css'],
            'js':      ['build:js'],
            'images':  ['build:images'],
            'copy':    ['build:copy'],
            'html':    ['build:html'],
            'sprites': ['build:sprites'],
            'jekyll':  ['jekyll']
        };

    // Default task is to watch assets
    gulp.task('default', ['watch']);

    gulp.task('watch', ['start', 'server', 'build'], function () {
        $env.server.reload();

        var watchers = {},
            configurations = $env.start();

        for (var file in watchFiles) {
            if (watchFiles.hasOwnProperty(file)) {
                if (file === 'assets.json') {
                    watchers[file] = gulp.watch($env.configuration_files, ['watch:' + file]);
                }
                else {
                    watchers[file] = gulp.watch(file, ['watch:' + file]);
                }
            }
        }

        for (var task in watchTasks) {
            if (watchTasks.hasOwnProperty(task)) {
                configurations.forEach(function (configuration) {
                    var src = [],
                        taskName = configuration.hasOwnProperty('moduleFolder') ? configuration.moduleFolder + ':' + task : task;

                    if (configuration.hasOwnProperty(task)) {
                        if (Array.isArray(configuration[task])) {
                            configuration[task].forEach(function (minorTask) {
                                if($defaults.hasOwnProperty(task))
                                    minorTask = $helpers.merge_objects($defaults[task], minorTask);

                                if (minorTask.hasOwnProperty('watch')) {
                                    src = src.concat(minorTask.watch);
                                }
                                else if (minorTask.hasOwnProperty('src')) {
                                    src = src.concat(minorTask.src);
                                }
                            });
                        }
                        else {
                            if($defaults.hasOwnProperty(task))
                                configuration[task] = $helpers.merge_objects($defaults[task], configuration[task]);

                            if (configuration[task].hasOwnProperty('watch')) {
                                src = src.concat(configuration[task].watch);
                            }
                            else if (configuration[task].hasOwnProperty('src')) {
                                src = src.concat(configuration[task].src);
                            }
                        }
                    }

                    if (src.length) {
                        watchers[taskName] = gulp.watch(src, function(tasks, config){
                            return function() {
                                $env.set('configuration_override', config);

                                $helpers.sequence.use(gulp)(tasks, function() {
                                    $env.set('configuration_override', null);
                                });
                            };
                        }(watchTasks[task], configuration));
                    }
                });
            }
        }

        if ($env.project().hasOwnProperty('refresh')) {
            watchers['refresh'] = gulp.watch($env.project().refresh, ['server:reload']);
        }

        for (var key in watchers) {
            if (watchers.hasOwnProperty(key)) {
                (
                    function (name) {
                        watchers[key].on('change', function (event) {
                            $.util.beep();
                            $.util.log('File ' + event.path + ' was ' + event.type + ', running tasks...');

                            if (event.type === 'deleted') {
                                if ($.cached.caches.hasOwnProperty(name) && $.cached.caches[name].hasOwnProperty(event.path)) {
                                    delete $.cached.caches[name][event.path];
                                    $.remember.forget(name, event.path);
                                }

                                if (name === 'js' && $.cached.caches.hasOwnProperty('js.lint') && $.cached.caches['js.lint'].hasOwnProperty(event.path)) {
                                    delete $.cached.caches['js.lint'][event.path];
                                    $.remember.forget('js.lint', event.path);
                                }
                            }
                        });
                    }(key)
                );
            }
        }
    });

    // Set up watches for some JSON files
    for (var file in watchFiles) {
        if (watchFiles.hasOwnProperty(file)) {
            gulp.task('watch:' + file, watchFiles[file], function (done) {
                $helpers.sequence.use(gulp)(
                    'build',
                    function () {
                        $env.server.reload();
                        done();
                    }
                );
            });
        }
    }
};