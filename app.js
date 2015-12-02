var fs            = require('fs');
var express       = require('express');
var child_process = require('child_process');
var email         = require('./email.js');
var tools         = require('./tools.js');
var uuid          = require('node-uuid');
var crypto        = require('crypto');
var config        = JSON.parse(fs.readFileSync('config.json','utf-8'));
var app           = express();

var shadowsocksProcess = null;

// ！！！强烈建议使用https！！！
// ！！！强烈建议使用https！！！
// ！！！强烈建议使用https！！！

// X-Forwarded-For
if(config.nginxProxy) app.enable('trust proxy');

app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));

// 判断Shadowsocks是否已经安装
if(!fs.existsSync(config.shadowsocksPath)){
    console.error('Shadowsocks does\'t exist, Please check Shadowsocks is already installed.');
    process.exit(1);
}

// 判断Shadowsocks配置文件是否存在
if(!fs.existsSync(config.shadowsocksConfig)){
    console.info('Shadowsocks config does\'t exist,will create default configuration.');
    fs.writeFileSync(config.shadowsocksConfig, JSON.stringify(config.shadowsocksDefaultConfig, null, 4));
}

checkChangeTime();
setInterval(function() {
    checkChangeTime();
}, 10 * 1000);

function checkChangeTime(){
    // 判断是否到了需要重新更换密码或端口的时间了
    var now = Math.floor(Date.now() / 1000);
    if(config.nextChangeTime > now){
        if(shadowsocksProcess != null) return;

        shadowsocksProcess = child_process.spawn(config.shadowsocksPath, [
            '-c',
            config.shadowsocksConfig
        ]);

        shadowsocksProcess.on('error',function(data){
            process.stdout.write('Shadowsocks launch error:' + data.toString("utf-8"));
        });
        shadowsocksProcess.stdout.on('data', function(data){
            process.stdout.write('Shadowsocks output:'+data.toString("utf-8"));
        });
        shadowsocksProcess.stderr.on('data', function(data){
            process.stdout.write('Shadowsocks output:'+ data.toString("utf-8"));
        });
        shadowsocksProcess.on('exit', function (code) {
            console.log('Shadowsocks exit code:', code);
            shadowsocksProcess = null;
        });
        return;
    }else{
        if(shadowsocksProcess != null)  shadowsocksProcess.kill('SIGKILL');
    }
    config.nextChangeTime = now + config.autoChangeTimer;
    fs.writeFileSync('config.json', JSON.stringify(config, null, 4));

    var newPassword = tools.getMd5(uuid.v4());
    var newPort     = tools.getRandomNum(config.nextChangePortMin, config.nextChangePortMax);

    // 判断SS配置是否存在 防止在检测间隔期间被删除
    if(!fs.existsSync(config.shadowsocksConfig)){
        console.info('Shadowsocks config does\'t exist,will create default configuration.');
        fs.writeFileSync(config.shadowsocksConfig, JSON.stringify(config.shadowsocksDefaultConfig, null, 4));
    }

    console.log('Shadowsocks configuration update Port: ', config.nextChangPort ? newPort : 'no change', 'Password:', config.nextChangePassword ? newPassword : 'no change');

    // 更新密码或端口 重新写入Shadowsocks配置文件
    var shadowsocksConfig = JSON.parse(fs.readFileSync(config.shadowsocksConfig,'utf-8'));
    if(config.nextChangPort) shadowsocksConfig.server_port = newPort;
    if(config.nextChangePassword) shadowsocksConfig.password = newPassword;
    fs.writeFileSync(config.shadowsocksConfig, JSON.stringify(shadowsocksConfig, null, 4));

    config.reportUsers.map(function(item){
        var noticeId = tools.getMd5(uuid.v4());
        // notice id 是否已经存在, 已存在重新生成
        while(fs.existsSync('./data/' + noticeId + '.json')) noticeId = tools.getMd5(uuid.v4());
        // 拼接配置文件内域名与生成的id
        var noticeDomain = config.noticeDomain + noticeId;
        var noticeData = {
              email : item,
              expire: 0,
              password: config.nextChangePassword ? newPassword : '',
              port: config.nextChangPort ? newPort : '',
              ip:{}
        };

        //发送通知邮件
        email.sendEmail(item, 'Shadowsocks configuration update', 'Please click <a href="' + noticeDomain + '">here</a> continue.', function(err, result){
            if(err) return console.error('Send email to ', item, 'error', err);
            fs.writeFileSync('./data/' + noticeId + '.json', JSON.stringify(noticeData, null, 4));
        });
    });
}

app.get('/', function(req, res){
    res.send('', 404);
});

app.get('/:noticeId', function (req, res) {
    var noticeId = req.params.noticeId;
    var dataPath = './data/' + noticeId + '.json';
    // 判断文件是否存在并解析
    if(!fs.existsSync(dataPath)) return res.render('notice', {'found': false});
    var data = null;
    try {
        data = JSON.parse(fs.readFileSync(dataPath,'utf-8'));
    } catch (error) {
        return res.render('notice', {'found': false});
    }
    // 判断通知内容是否已经过期 如果为0表示从未被访问过
    var now = Math.floor(Date.now() / 1000);
    if(data.expire < now && data.expire != 0) return res.render('notice', {'found': false});
    if(data.expire == 0) data.expire = now + config.reportExpireTime;

    data.ip[req.ip] = now;

    res.render('notice', {
        found: true,
        port : data.port,
        password: data.password,
        expire: data.expire - now,
        ip: data.ip,
        ipCount: Object.keys(data.ip).length,
        clientIp: req.ip
    });

    // 将重新修改过访问IP的数据重新写入json
    fs.writeFileSync('./data/' + noticeId + '.json', JSON.stringify(data, null, 4));
});

var server = app.listen(config.servicePort, function () {
    console.log('Shadowsocks Tools listening at:', config.servicePort);
});
