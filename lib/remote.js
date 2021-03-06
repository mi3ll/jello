var $ssh = require('ssh2'),
    $enquire = require('inquirer');

module.exports = function (gulp, $, $env) {
    var $defaults = $env.$defaults,
        $helpers = require("./helpers")(gulp, $, $env),
        $shell = $env.shell;

    var findTarget = function (target, overrides) {
            if (!$env.project().hasOwnProperty('targets') || !$env.project().targets.hasOwnProperty(target)) {
                return false;
            }// Check project for driver, or use a different driver specified in its settings (so you can use same
             // details for multiple drivers)
            else if ($env.project().targets[target].hasOwnProperty('target') && target != $env.project().targets[target].target) {
                if(overrides) {
                    for (var option in overrides) {
                        if (overrides.hasOwnProperty(option)) {
                            options[option] = overrides[option];
                        }
                    }
                }

                return findTarget($env.project().targets[target].target, overrides);
            }

            else {
                return $env.project().targets[target];
            }
        },

        dateForFiles = function () {
            return new Date().toISOString().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        },

        configHasOneOfArrayAsProperty = function (possibleProps, config) {
            for (var i = 0; i < possibleProps.length; i++) {
                if (config.hasOwnProperty(possibleProps[i])) {
                    return possibleProps[i];
                }
            }

            return false;
        },

        validRsyncArgs = function (options) {
            var args = [], i;

            for (var option in options) {
                if (options.hasOwnProperty(option)) {
                    if (option === 'port') {
                        args.push("--rsh='ssh -p" + options[option] + "'");
                    }

                    if (option === 'itemize-changes') {
                        args.push('--itemize-changes=');
                        continue;
                    }

                    if ($defaults.remote.validArguments.indexOf(option) === -1) {
                        continue;
                    }

                    if (options[option] === true) {
                        args.push('--' + option);
                    }
                    else if (Array.isArray(options[option])) {
                        for (i = 0; i < options[option].length; i++) {
                            args.push('--' + option + "='" + options[option][i] + "'");
                        }

                        if (options.hasOwnProperty(option + '-additional')) {
                            if (Array.isArray(options[option + '-additional'])) {
                                for (i = 0; i < options[option + '-additional'].length; i++) {
                                    args.push('--' + option + "='" + options[option + '-additional'][i] + "'");
                                }
                            }
                            else {
                                args.push('--' + option + "='" + options[option + '-additional'] + "'");
                            }
                        }
                    }
                    else if (options[option] !== false) {
                        args.push('--' + option + "='" + options[option] + "'");
                    }
                }
            }

            if (options.hasOwnProperty('rsync-args')) {
                if (Array.isArray(options['rsync-args'])) {
                    for (i = 0; i < options['rsync-args'].length; i++) {
                        args.push(options['rsync-args'][i]);
                    }
                }
                else {
                    args.push(options['rsync-args']);
                }
            }

            return args;
        },

        reverseSrcAndDest = function (configuration, overrides) {
            var options = JSON.parse(JSON.stringify(configuration));

            delete options.dest;
            delete options.host;
            delete options.username;
            delete options.src;
            delete options.srcHost;
            delete options.srcUsername;

            if (overrides) {
                for (var option in overrides) {
                    if (overrides.hasOwnProperty(option)) {
                        options[option] = overrides[option];
                    }
                }
            }

            options.src = configuration.dest;
            options.dest = configuration.src;

            if (configuration.hasOwnProperty('host')) {
                options.srcHost = configuration.host;

                if (configuration.hasOwnProperty('username')) {
                    options.srcUsername = configuration.username;
                }
            }

            if (configuration.hasOwnProperty('srcHost')) {
                options.host = configuration.srcHost;

                if (configuration.hasOwnProperty('srcUsername')) {
                    options.username = configuration.srcUsername;
                }
            }

            return options;
        },

        sync = function (configuration, callback, backups, noCommands) {
            if (backups && Array.isArray(backups) && configHasOneOfArrayAsProperty(configuration, backups)) {
                backup(configuration, callback, null, null, backups);
            }
            else if (backups && configuration.hasOwnProperty(backups)) {
                backup(configuration, callback, backups);
            }
            else {
                var option,
                    options = JSON.parse(JSON.stringify($defaults.remote.options)),
                    asRelease = false,
                    pwd = $helpers.rtrim($shell.pwd(), '/'),
                    vars = {
                        'PWD':     pwd,
                        'HOME':    $helpers.home(),
                        'DATE':    dateForFiles(),
                        'PROJECT': $helpers.parent_folder(),
                        'TMPDIR':  process.env.TMPDIR,
                        'PROXY': $env.project().hasOwnProperty('server') && $env.project().server.hasOwnProperty('proxy') ? $helpers.rtrim($env.project().server.proxy.replace('http://', ''), '/') : ''
                    };

                for (option in configuration) {
                    if (configuration.hasOwnProperty(option)) {
                        options[option] = configuration[option];
                    }
                }

                if(options.hasOwnProperty('as-release'))
                    asRelease = true;

                var args = validRsyncArgs(options);

                if (options.hasOwnProperty('dest')) {
                    var destFolder = $helpers.rtrim($helpers.replace_vars(options.dest, vars), '/'),
                        dest,
                        src,
                        srcFolder = options.hasOwnProperty('src') ? $helpers.rtrim($helpers.replace_vars(options.src, vars), '/') + '/' : pwd + '/';

                    if (options.hasOwnProperty('host')) {
                        dest = options.host + ':' + destFolder;

                        if (options.hasOwnProperty('username')) {
                            dest = options.username + '@' + dest;
                        }
                    }
                    else {
                        dest = destFolder + '/';
                        $shell.exec('mkdir -p ' + dest);
                    }

                    if (options.hasOwnProperty('srcHost')) {
                        src = options.srcHost + ':' + srcFolder;

                        if (options.hasOwnProperty('srcUsername')) {
                            src = options.srcUsername + '@' + src;
                        }
                        else if (options.hasOwnProperty('username')) {
                            src = options.username + '@' + src;
                        }
                    }
                    else {
                        src = srcFolder;
                        $shell.exec('mkdir -p ' + srcFolder);
                    }

                    var fullyRemote = options.srcHost && options.host,
                        remoteSettings = {};

                    if(fullyRemote) {
                        for(option in options) {
                            if(options.hasOwnProperty(option)) {
                                if(options.hasOwnProperty('src' + option.charAt(0).toUpperCase() + option.slice(1))) {
                                    remoteSettings[option] = options['src' + option.charAt(0).toUpperCase() + option.slice(1)];
                                }
                                else {
                                    remoteSettings[option] = options[option];
                                }
                            }
                        }
                    }

                    var append = '';

                    if(options.hasOwnProperty('save-output-to') || (remoteSettings.hasOwnProperty('itemize-changes') && typeof options['itemize-changes'] !== 'boolean')) {
                        var outputFile = options.hasOwnProperty('save-output-to') ? options['save-output-to'] : options['itemize-changes'];
                        append = ' | tee -a ' + outputFile;
                    }

                    if (noCommands) {
                        // Both are destinations, so we are going to ssh into one to rsync to the other
                        if(fullyRemote) {
                            execute(['rsync ' + args.join(' ') + ' ' + srcFolder + ' ' + dest + append], remoteSettings, function (code, output) {
                                if (callback) {
                                    callback.apply(this, [dest, src, options, code, output]);
                                }
                            }, dest);
                        }
                        else {
                            execute(['rsync ' + args.join(' ') + ' ' + src + ' ' + dest + append], {'dry-run': options.hasOwnProperty('dry-run') && options['dry-run']}, function (code, output) {
                                if (callback) {
                                    callback.apply(this, [dest, src, options, code, output]);
                                }
                            });
                        }
                    }
                    else {
                        var afterCallback = function() {
                            $.util.beep();

                            after(dest, src, options, callback);
                        };

                        before(dest, src, options, function () {
                            if(fullyRemote) {
                                execute(['rsync ' + args.join(' ') + ' ' + srcFolder + ' ' + dest + append], remoteSettings, function (code, signal, stream, output) {
                                    afterCallback(output);
                                }, dest);
                            }
                            else {
                                execute(['rsync ' + args.join(' ') + ' ' + src + ' ' + dest + append], {'dry-run': options.hasOwnProperty('dry-run') && options['dry-run']}, function (code, output) {
                                    afterCallback(output);
                                });
                            }
                        });
                    }
                }
                else if (callback) {
                    callback();
                }
                else {
                    return false;
                }
            }
        },

        backup = function (configuration, callback, backupsProperty, noSync, onEachCb) {
            var backupOptions,
                backupsPropertyToUse = function () {
                    if (Array.isArray(backupsProperty)) {
                        return configHasOneOfArrayAsProperty(backupsProperty);
                    }
                    else {
                        return backupsProperty
                    }
                }(),
                options = reverseSrcAndDest(configuration, $defaults.remote.backupOptions),
                pwd = $helpers.rtrim($shell.pwd(), '/'),
                time = dateForFiles(),
                vars = {
                    'PWD':     pwd,
                    'HOME':    $helpers.home(),
                    'DATE':    time,
                    'PROJECT': $helpers.parent_folder(),
                    'TMPDIR':  process.env.TMPDIR,
                    'PROXY': $env.project().hasOwnProperty('server') && $env.project().server.hasOwnProperty('proxy') ? $helpers.rtrim($env.project().server.proxy.replace('http://', ''), '/') : ''
                },
                finished = 0,
                ifDone = function () {
                    if (finished >= options[backupsPropertyToUse].length) {
                        if (noSync && callback) {
                            callback();
                        }
                        else if (!noSync) {
                            sync(configuration, callback);
                        }
                    }
                };

            if(!options.hasOwnProperty(backupsPropertyToUse)) {
                if (noSync && callback) {
                    callback();
                }
                else if (!noSync) {
                    sync(configuration, callback);
                }

                return;
            }

            for (var i = 0; i < options[backupsPropertyToUse].length; i++) {
                backupOptions = JSON.parse(JSON.stringify(options));

                for (var option in options[backupsPropertyToUse][i]) {
                    if (options[backupsPropertyToUse][i].hasOwnProperty(option)) {
                        backupOptions[option] = options[backupsPropertyToUse][i][option];
                    }
                }

                if (backupOptions.hasOwnProperty('host') || backupOptions.hasOwnProperty('srcHost')) {
                    backupOptions.dest = $helpers.rtrim($helpers.replace_vars(backupOptions.dest, vars), '/') + '/';

                    if (backupOptions.hasOwnProperty('itemize-changes')) {
                        if (backupOptions.hasOwnProperty('name')) {
                            backupOptions.dest = backupOptions.dest + backupOptions.name;
                        }
                    }
                    else {
                        backupOptions.dest = backupOptions.dest + time;
                    }

                    if (!backupOptions.hasOwnProperty('dry-run') && backupOptions.hasOwnProperty('itemize-changes')) {
                        backupOptions['save-output-to'] = backupOptions.dest + '.backup.' + time + '.txt';
                    }

                    sync(backupOptions, function (dest, src, backupOptions, code, output) {
                        if (onEachCb) {
                            onEachCb(dest, src, backupOptions, code, output);
                        }

                        $helpers.notify(src + ' has been backed up to ' + dest);
                        finished++;

                        ifDone();
                    }, null, true);
                }
                else {
                    backupOptions.dest = $helpers.rtrim($helpers.replace_vars(backupOptions.dest, vars), '/') + '/.backup.' + time + '.tar.gz';

                    $shell.exec('tar -zhcvf \'' + backupOptions.dest + '\' ' + backupOptions.src, function (backupOpts) {
                        if (onEachCb) {
                            onEachCb(backupOpts.dest, backupOpts.src, backupOpts);
                        }

                        $helpers.notify(backupOpts.src + ' has been backed up to ' + backupOpts.dest);
                        finished++;

                        ifDone();
                    }(backupOptions));
                }
            }
        },

        before = function (dest, src, configuration, callback) {
            executeCommands('dest-commands-before', 'src-commands-before', dest, src, configuration, callback);
        },

        after = function (dest, src, configuration, callback) {
            executeCommands('dest-commands-after', 'src-commands-after', dest, src, configuration, callback);
        },

        executeCommands = function (destCommandsKey, srcCommandsKey, dest, src, configuration, callback, execSettings) {
            var all = 0,
                done = 0,
                commandsDone = [],
                ifDone = function () {
                    done++;

                    if (callback && done >= all) {
                        callback.apply(this, [dest, src, configuration, commandsDone]);
                    }
                };

            if (configuration.hasOwnProperty(destCommandsKey)) {
                all++;
            }

            if (configuration.hasOwnProperty(srcCommandsKey)) {
                all++;
            }

            if (configuration.hasOwnProperty(destCommandsKey)) {
                if(dest)
                    $.util.log('Executing commands on destination: ' + dest);

                commandsDone.push(destCommandsKey);

                var destConfiguration = JSON.parse(JSON.stringify(configuration));

                execute(destConfiguration[destCommandsKey], destConfiguration, function () {
                    ifDone();
                }, dest, execSettings);
            }

            if (configuration.hasOwnProperty(srcCommandsKey)) {
                if(src)
                    $.util.log('Executing commands on source: ' + src);

                commandsDone.push(srcCommandsKey);

                var srcConfiguration = JSON.parse(JSON.stringify(configuration));

                if (srcConfiguration.hasOwnProperty('srcHost')) {
                    srcConfiguration.destHost = configuration.host;
                    srcConfiguration.host = configuration.srcHost;
                }
                else {
                    srcConfiguration.host = null;
                }

                if (srcConfiguration.hasOwnProperty('src')) {
                    srcConfiguration.destDest = configuration.dest;
                    srcConfiguration.dest = configuration.scr;
                }
                else {
                    srcConfiguration.dest = null;
                }

                execute(srcConfiguration[srcCommandsKey], srcConfiguration, function () {
                    ifDone();
                }, dest, execSettings);
            }

            if (!all) {
                ifDone();
            }
        },

        execute = function (commands, configuration, callback, dest, execSettings) {
            if (commands && commands.length) {
                var commandsVars = {
                    'PWD':     $helpers.rtrim($shell.pwd(), '/'),
                    'DEST':    configuration.dest,
                    'SRC':     configuration.hasOwnProperty('src') ? $helpers.rtrim(configuration.src, '/') : $helpers.rtrim($shell.pwd(), '/'),
                    'HOME':    $helpers.home(),
                    'TMPDIR':  process.env.TMPDIR,
                    'DATE':    dateForFiles(),
                    'PROJECT': $helpers.parent_folder(),
                    'BACKTICK': '\\\`',
                    'PROXY': $env.project().hasOwnProperty('server') && $env.project().server.hasOwnProperty('proxy') ? $helpers.rtrim($env.project().server.proxy.replace('http://', ''), '/') : ''
                };

                for (var i = 0; i < commands.length; i++) {
                    commands[i] = $helpers.replace_vars($helpers.replace_vars(commands[i], commandsVars), commandsVars);
                }

                configuration = JSON.parse(JSON.stringify(configuration));

                var destFolder = configuration.hasOwnProperty('dest') ? $helpers.replace_vars($helpers.replace_vars(configuration.dest, commandsVars), commandsVars) : '~';

                if (destFolder && destFolder.indexOf('~') !== 0) {
                    commands.unshift('cd ' + destFolder);
                }

                if (configuration.hasOwnProperty('host') && configuration.host) {
                    if (configuration.hasOwnProperty('dry-run')) {
                        $.util.log('Will execute the following commands on ' + dest + "\n" + commands.join("\n"));

                        if (callback) {
                            callback.apply(this);
                        }
                    }
                    else {
                        configuration = $helpers.attach_private_key(configuration);

                        if(!dest) {
                            dest = configuration.username + '@' + configuration.host + ':' + destFolder;
                        }

                        if(!execSettings)
                            execSettings = {};

                        var Client = $ssh.Client,
                            client = new Client(),
                            fn = execSettings.hasOwnProperty('shell') ? 'shell' : 'exec',
                            passwordFromPrompt = '',
                            startClient = function() {
                                client.on('ready', function () {
                                    $helpers.notify('Connected to: ' + dest);
                                    client[fn](commands.join(' && '), execSettings, function (err, stream) {
                                        if (err) {
                                            throw err;
                                        }

                                        var usePassword = false, buffer = '';

                                        stream
                                          .on('close', function (code, signal) {
                                                  console.log('Connection closed');
                                                  client.end();

                                                  if (callback) {
                                                      callback.apply(this, [code, signal, stream, buffer, dest]);
                                                  }
                                              }).on('data', function (data) {
                                                        if (!usePassword && String(data).trim() === '[sudo] password for ' + configuration.username + ':') {
                                                            if(execSettings.sudoPassword)
                                                                stream.write(execSettings.sudoPassword + '\n');
                                                            else if(configuration.password)
                                                                stream.write(configuration.password + '\n');
                                                            else if(passwordFromPrompt)
                                                                stream.write(passwordFromPrompt + '\n');
                                                            else {
                                                                console.log('No password detected. Please pass a password using --pass=""');
                                                                stream.close();
                                                            }
                                                            buffer = '';
                                                            usePassword = true;
                                                        } else if(data.toString().trim() === 'Sorry, try again.') {
                                                            console.log('No password detected. Please pass a password using --pass=""');
                                                            stream.close();
                                                        } else if(data.toString().trim()) {
                                                            console.log('STDOUT: ' + data);
                                                            buffer += data.toString();
                                                        }
                                                    }).on('error', function (data) {
                                                              console.log('STDERR: ' + data);
                                                          }).stderr.on('data', function (data) {
                                                                           console.log('STDERR: ' + data);
                                                                       });
                                    });
                                }).connect(configuration);
                            };

                        if(commands.join(' && ').indexOf('sudo') !== -1) {
                            execSettings.pty = true;
                            process.stdout.write('\033c');
                            $enquire.prompt([{
                                type: "password",
                                message: "Enter your password for admin privileges to this target",
                                name: "password"
                            }], function(answers) {
                                passwordFromPrompt = answers.password;
                                startClient();
                            });
                        }
                        else {
                            startClient();
                        }
                    }
                }
                else if (configuration.hasOwnProperty('dry-run') && configuration['dry-run']) {
                    $.util.log('Will execute the following commands in current directory' + "\n" + commands.join("\n"));

                    if (callback) {
                        callback.apply(this);
                    }
                }
                else {
                    $shell.exec(commands.join(' && '), function (code, output) {
                        if (callback) {
                            callback.apply(this, [code, output]);
                        }
                    });
                }
            }
        };

    // Check if git is available
    exports.is_available = function () {
        if (!$shell.which('rsync')) {
            $helpers.notify('Rsync is not installed.');
            return false;
        }

        return true;
    };

    // Find a target from the project settings
    exports.find_target = findTarget;

    // Collect rsync args that are valid
    exports.rsync_args = validRsyncArgs;

    // Backup a folder according to settings
    exports.backup = backup;

    // Remote sync a folder according to settings
    exports.sync = sync;

    // Execute on a configuration
    exports.execute = execute;

    // Execute on a src and dest
    exports.execute_src_and_dest = executeCommands;

    // Reverse the source and destination
    exports.reverse_src_and_dest = reverseSrcAndDest;

    return exports;
};