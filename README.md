# Extension Manager
The Purpose of this extension is to help manage your extensions.
Currently this only manages a list of extension that you wish to install.

## Install
Open up VS Code and then hit `F1` and type ext, select install and then type `Extension Manager`.
hit enter and reload the window to enable the extensions.

## Usage
In your settings.json file you can include the following configuration
`publisher.extension`.

##### settings.json
```
{
    "extension-manager.extensions": [
        "publisher.extension" //replace this with desired extension
    ]
}
```

