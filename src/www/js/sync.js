define(['records', 'settings', 'config', './login'], function(records, settings, config, login){
    var cloudProviderUrl = config["pcapi_url"]+"/" + config["pcapi_version"] + "/pcapi";
    login.init(cloudProviderUrl);

    //settings.addControl('pcapi-url', 'select');
    settings.get('pcapi-url');

    $(document).on('vclick', '#home-content-login', $.proxy(login.loginCloud, login));
});