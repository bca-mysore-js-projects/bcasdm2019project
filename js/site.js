var ChatApp = window.ChatApp || {};

(function scopeWrapper($) {

    var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    var token = null;

    var lastChat = null;

    var apiClient = apigClientFactory.newClient();

    function getProfile () {
        var val;
        // get list of radio buttons with specified name
        var radios = document.getElementById('signupForm').elements['profile'];

        // loop through list of radio buttons
        for (var i=0, len=radios.length; i<len; i++) {
            if ( radios[i].checked ) { // radio checked?
                val = radios[i].value; // if so, hold its value in val
                break; // and break out of for loop
            }
        }
        return val; // return value of checked radio or undefined if none checked
    }

    ChatApp.checkLogin = function (redirectOnRec, redirectOnUnrec) {
        var cognitoUser = userPool.getCurrentUser();
        if (cognitoUser !== null) {
            if (redirectOnRec) {
                window.location = '/chats.html';
            }
        } else {
            if (redirectOnUnrec) {
                window.location = '/';
            }
        }
    };

    ChatApp.login = function () {
        var username = $('#username').val();
        var authenticationData = {
            Username: username,
            Password: $('#password').val()
        };

        var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
        var userData = {
            Username: username,
            Pool: userPool
        };
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function () {
                window.location = '/chats.html';
            },
            onFailure: function (err) {
                alert(err);
            }
        });
    };

    ChatApp.logout = function () {
        var cognitoUser = userPool.getCurrentUser();
        cognitoUser.signOut();
        window.location = '/';
    };

    ChatApp.populateChats = function () {
        ChatApp.useToken(function (token) {
            apiClient.conversationsGet({}, null, {headers: {Authorization: token}})
                .then(function (result) {
                    var currentUsername = userPool.getCurrentUser().getUsername();

                    result.data.forEach(function (convo) {
                        var otherUsers = [];
                        convo.participants.forEach(function (user) {
                            if (user !== currentUsername) {
                                otherUsers.push(user);
                            }
                        });

                        var last = '&nbsp;';
                        if (convo.last) {
                            last = moment(new Date(convo.last)).fromNow();
                        }

                        $('TBODY').append('<tr><td><a href="chat.html#' + convo.id + '">' + otherUsers.join(', ') + '</a></td><td>' + last + '</td></tr>');
                    });
                    $('TBODY').append('<tr><td></td><td></td></tr>');
                });
        });
    };

    ChatApp.loadChat = function () {
        var currentUsername = userPool.getCurrentUser().getUsername();
        ChatApp.useToken(function (token) {
            apiClient.conversationsIdGet({id: location.hash.substring(1)}, null, {headers: {Authorization: token}})
                .then(function (result) {
                    var lastRendered = lastChat === null ? 0 : lastChat;
                    if((lastChat === null && result.data.last) || lastChat < result.data.last) {
                        lastChat = result.data.last;
                    } else {
                        return;
                    }
                    result.data.messages.forEach(function (message) {
                        if(message.time > lastRendered) {
                            var panel = $('<div class="panel">');
                            if (message.sender === currentUsername) {
                                panel.addClass('panel-default');
                            } else {
                                panel.addClass('panel-info');
                                panel.append('<div class="panel-heading">' + message.sender + '</div>');
                            }
                            var body = $('<div class="panel-body">').text(message.message);
                            panel.append(body);
                            panel.append('<div class="panel-footer messageTime" data-time="' + message.time + '">' + moment(message.time).fromNow() + '</div>');

                            var row = $('<div class="row">');
                            var buffer = $('<div class="col-xs-4">');
                            var holder = $('<div class="col-xs-8">');
                            holder.append(panel);

                            if (message.sender === currentUsername) {
                                row.append(buffer);
                                row.append(holder);
                            } else {
                                row.append(holder);
                                row.append(buffer);
                            }

                            $('#chat').append(row);
                        }
                    });
                    window.scrollTo(0, document.body.scrollHeight);
                });
        });
    };

    ChatApp.send = function () {
        // We can assume the token will be set by now
        ChatApp.useToken(function(token) {
            apiClient.conversationsIdPost({id: location.hash.substring(1)}, $('#message').val(), {headers: {Authorization: token}})
                .then(function () {
                    $('#message').val('').focus();
                    ChatApp.loadChat();
                });
        });
    };

    ChatApp.populatePeople = function () {
        ChatApp.useToken(function (token) {
            apiClient.usersGet({}, null, {headers: {Authorization: token}})
                .then(function (result) {
                    result.data.forEach(function (user) {
                        var button = $('<button class="btn btn-primary">Start Chat</button>');
                        button.on('click', function() {
                            ChatApp.startChat(user.name);
                        });
                        var profile = user.profile ? '<img width="30" height="30" src="./images/' + user.profile + '.png" alt="profle"/>' : '';
                        var row = $('<tr>');
                        row.append('<td>' + user.name + ' ' + profile + '</td>');
                        var cell = $('<td>');
                        cell.append(button);
                        row.append(cell);
                        $('TBODY').append(row);
                    });
                    $('TBODY').append('<tr><td></td><td></td></tr>');
                });
        });
    };

    ChatApp.startChat = function (name) {
        // We know the token will be set by now
        apiClient.conversationsPost({}, [name], {headers: {Authorization: token}})
            .then(function (result) {
                window.location = '/chat.html#' + result.data;
            });
    };
    ChatApp.initializeSignup = function () {
        $("#profileContainer input").click(function(event){
            if ($(event.target).val() === 'patient') {
                $('#specialisationContainer').hide();
                $('#diseaseContainer').show();
            }
            if ($(event.target).val() === 'doctor') {
                $('#specialisationContainer').show();
                $('#diseaseContainer').hide();
            }
        });
    };
    ChatApp.signup = function () {
        var username = $('#username').val();
        var password = $('#password').val();
        var email = new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'email',
            Value: $('#email').val()
        });
        var profile = new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'custom:profile',
            Value: getProfile()
        });
        var specialisation = new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'custom:specialisation',
            Value: $('#specialisation').val()
        });
        var disease = new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'custom:disease',
            Value: $('#custom').val()
        });
        var mobile = new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'custom:mobile',
            Value: $('#mobile').val()
        });

        var data = [email, profile, mobile];

        if (getProfile() === 'patient') {
            data.push(disease);
            data.push(new AmazonCognitoIdentity.CognitoUserAttribute({
                Name: 'custom:patientid',
                Value: JSON.stringify(Date.now()%1000000)
            }));
        } else {
            data.push(specialisation);
            data.push(new AmazonCognitoIdentity.CognitoUserAttribute({
                Name: 'custom:doctorid',
                Value: JSON.stringify(Date.now()%1000000)
            }));
        }

        userPool.signUp(username, password, data, null, function (err, result) {
            if (err) {
                alert(err);
            } else {
                window.location = '/confirm.html#' + username;
            }
        });
    };

    ChatApp.confirm = function () {
        var username = location.hash.substring(1);
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool
        });
        cognitoUser.confirmRegistration($('#code').val(), true, function (err, results) {
            if (err) {
                alert(err);
            } else {
                window.location = '/';
            }
        });
    };

    ChatApp.resend = function () {
        var username = location.hash.substring(1);
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool
        });
        cognitoUser.resendConfirmationCode(function (err) {
            if (err) {
                alert(err);
            }
        })
    };

    ChatApp.useToken = function (callback) {
        if (token === null) {
            var cognitoUser = userPool.getCurrentUser();
            if (cognitoUser !== null) {
                cognitoUser.getSession(function (err, session) {
                    if (err) {
                        window.location = '/';
                    }
                    token = session.getIdToken().getJwtToken();
                    callback(token);
                });
            }
        } else {
            callback(token);
        }
    };

}(jQuery));