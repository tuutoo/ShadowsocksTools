var nodemailer = require('nodemailer');
var config     = require('./config.json');

var transporter = nodemailer.createTransport({
    host: config.emailHost,
    secureConnection: true,
    port: 587,
    auth: {
        user: config.emailAccount,
        pass: config.emailPassword
    }
});

exports.sendEmail = function (email, title, content, callback){
    var mailOptions = {
        from: config.emailAccount,
        to: email,
        subject: title,
        html: content
    };

    transporter.sendMail(mailOptions, function(error, info){
        if(error) return callback(error, null);
        callback(null, info.response);
    });
}