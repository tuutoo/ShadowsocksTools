var crypto = require('crypto');

module.exports = {
    getRandomNum: function (Min,Max){ 
        var Range = Max - Min; 
        var Rand = Math.random(); 
        return(Min + Math.round(Rand * Range)); 
    },
    
    getMd5:function (content){
        return crypto.createHash('md5').update(content).digest('hex')
    }
};