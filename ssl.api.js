
module.exports = function (waw) {
  waw.api({
    domain: 'waiter.cloud',
    get: {
      '/.well-known/acme-challenge/Me92yJzRwICOt_saIfdMcWUThHwBPSxAJ9KuZTPyAZc': (req, res)=>{
        res.send('Me92yJzRwICOt_saIfdMcWUThHwBPSxAJ9KuZTPyAZc.Ckbi6rboZJC4m3tVJdZ7BpqcZ9DzMQefzvDTgFU3e1o');
      }
    }
  })
}
