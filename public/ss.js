var countDown = parseInt($('#countDown').html());
setInterval(function(){
    $('#countDown').html(--countDown);
    if(countDown <= 0) $('#noticeContent').html('本条通知未找到或已过期');
}, 1000);