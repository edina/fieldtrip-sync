define(['records', 'config', './login'], function(records, config, login){
    var cloudProviderUrl = config["pcapi_url"]+"/" + config["pcapi_version"] + "/pcapi";
    login.init(cloudProviderUrl);

    $(document).on('vclick', '#home-content-login', $.proxy(login.loginCloud, login));
});