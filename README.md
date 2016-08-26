# Extension Manager
This extension adds the ability to define a list of required extensions and install any extensions that are missing.

## Install
Open up VS Code and then hit `F1` and type ext, select install and then type `Extension Manager`.
hit enter and reload the window to enable the extensions.

## Contributions

### Configurations
```
{
    "extension-manager.extensions": [
        "(publisherName).(extensionName)
    ],
    "extension-manager.autoInstall: true
}
```

### Commands
* `Extension Manager: Install Missing Extensions` - to install missing extensions defined in your configuration

##Change Log: 
You can view the change log [here](https://gitbub.com/webstp/extension-manager/blob/master/CHANGELOG.md)



