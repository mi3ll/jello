module.exports = function (gulp, $, $env) {
    var $remote = require("../lib/remote")(gulp, $, $env),
        $helpers = require("../lib/helpers")(gulp, $, $env),

        isAvailable = function () {
            return $remote.is_available() && $env.project().hasOwnProperty('targets');
        },

        checkIfCanDeployViaTargets = function () {
            return $remote.is_available() && $env.project().hasOwnProperty('deploy') && $env.project().deploy.hasOwnProperty('targets');
        },

        getDefaultTarget = function () {
            for (var first in $env.project().targets) {
                if ($env.project().targets.hasOwnProperty(first))
                    return first;
            }

            return {};
        },

        applyToOneOrAllTargets = function (onProcess, onFinished, configurationToCheck, envProperty) {
            if (!envProperty)
                envProperty = 'to';

            if(!configurationToCheck)
                configurationToCheck = $env.project().targets;

            var target = use.util.env[envProperty];

            if (target) {
                var $target = $remote.find_target(target);

                if ($target === false) {
                    $helpers.notify('There are no settings for the target: ' + target);
                    done();
                    return;
                }

                $helpers.notify('Uploading to target: ' + target);

                $helpers.apply_to_array_or_one($target, onProcess, onFinished);
            }
            else {
                $helpers.notify('Uploading to all targets: ' + target);

                for (target in configurationToCheck) {
                    if (configurationToCheck.hasOwnProperty(target)) {
                        $helpers.notify('Executing target: ' + target);

                        $helpers.apply_to_array_or_one($env.project().targets[target], onProcess, onFinished);
                    }
                }
            }
        };

    gulp.task('targets:pull', function (done) {
        if (isAvailable()) {
            var target = $.util.env.from ? $.util.env.from : getDefaultTarget();

            if (!target) {
                $helpers.notify('You have no targets set up in your targets configuration', true);
                done();
                return;
            }

            var $target = $remote.find_target(target);

            if ($target === false) {
                $helpers.notify('There are no settings for the target: ' + target, true);
                done();
                return;
            }

            $helpers.notify('Downloading from target: ' + target);

            $helpers.apply_to_array_or_one($target, function (configuration, incrementUpdates, incrementFinished, ifDone) {
                incrementUpdates();

                var options = $remote.reverse_src_and_dest(configuration);

                options.dest = $helpers.rtrim($env.shell.pwd(), '/');
                delete options.host;
                delete options.username;

                $remote.sync(options, function (dest, src, options) {
                    $helpers.notify(src + ' has been downloaded from: ' + dest);
                    incrementFinished();
                    ifDone();
                }, 'pull-backups', true);
            }, done);
        }
        else {
            done();
        }
    });

    gulp.task('targets:push', ['start'], function (done) {
        if (isAvailable()) {
            applyToOneOrAllTargets(function (configuration, incrementUpdates, incrementFinished, ifDone) {
                incrementUpdates();

                $remote.sync(configuration, function (dest, src, options) {
                    $helpers.notify(src + ' has been uploaded to: ' + dest);
                    incrementFinished();
                    ifDone();
                }, 'push-backups');
            }, done);
        }
        else {
            done();
        }
    });

    gulp.task('targets:backup', ['start'], function (done) {
        if (isAvailable()) {
            applyToOneOrAllTargets(function (configuration, incrementUpdates, incrementFinished, ifDone) {
                incrementUpdates();

                $remote.backup(configuration, function () {
                    incrementFinished();
                    ifDone();
                }, 'push-backups', true, function(dest, src, options) {
                    $helpers.notify(src + ' has been backed up to: ' + dest);
                });
            }, done, null, 'target');
        }
        else {
            done();
        }
    });

    gulp.task('targets:deploy', ['start'], function (done) {
        if (checkIfCanDeployViaTargets()) {
            applyToOneOrAllTargets(function (configuration, incrementUpdates, incrementFinished, ifDone) {
                incrementUpdates();

                $remote.sync(configuration, function (dest, src, options) {
                    $helpers.notify(src + ' has been deployed to: ' + dest);
                    incrementFinished();
                    ifDone();
                }, ['deploy-backups', 'push-backups']);
            }, done, $env.project().deploy.targets);
        }
        else {
            done();
        }
    });
};