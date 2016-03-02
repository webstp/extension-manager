# Extension Manager
The Purpose of this extension is to help manage your extensions.
Currently this only manages a list of extension that you wish to install.

## Install
Open up VS Code and then hit `F1` and type ext, select install and then type `Extension Manager`.
hit enter and reload the window to enable the extensions.

## Settings
In your settings file you can include a list of extension that you wish to be installed 
##### settings.json
```
{
    "extension-manager.extensions": [
        "publisher.extension" //replace this with desired extension
    ]
}
```

## Commands
* `Extension Manager: Install Missing Extensions` - to install missing extensions from your list defined in settings.json



