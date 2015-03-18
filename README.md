# harian

You need to install node.js or io.js :)

```
$ npm install -g harian
```

```
$ harian --version
```

```
$ harian --help
```

```
$ harian ls
0. 15-Mar-2015 16:01 - 20150315-002
1. 16-Mar-2015 01:27 - 20150316
2. 17-Mar-2015 01:27 - 20150317
3. 18-Mar-2015 01:28 - 20150318
4. 18-Mar-2015 01:28 - current
```

```
$ harian diff current 20150317
current vs. 20150317
less (0):
greater (4):
  0. libgusb2 0.2.2-1 ~> 0.2.4-1
  1. libpython-stdlib 2.7.8-4 ~> 2.7.9-1
  2. python 2.7.8-4 ~> 2.7.9-1
  3. python-minimal 2.7.8-4 ~> 2.7.9-1
removed (0):
added (0):
```

```
$ harian sid current
http://cdimage.blankonlinux.or.id/blankon/livedvd-harian/current/tambora-desktop-amd64.list
greater (26):
  0. base-files 8blankon2 8
  1. busybox 1:1.22.0-15 1
  2. gcalctool 1:3.14.1-1 1
  3. gnome-control-center 1:3.14.2-3 1
  4. gnome-font-viewer 3.14.0-1blankon1 3.14.0-1
  5. gnome-icon-theme 3.12.0-1blankon1 3.12.0-1
  6. gnome-screenshot 3.14.0-1blankon1 3.14.0-1
  7. gnome-session 3.14.0-2blankon1 3.14.0-2
  8. gsettings-desktop-schemas 3.14.1-1blankon1 3.14.1-1
  9. gthumb 3:3.3.1-2+b2 3
  10. gtk2-engines-murrine 0.98.1.1-5.1blankon1 0.98.1.1-5
  11. gtk3-engines-unico 1.0.2+r139-0ubuntu2+blankon1 1.0.2-1
  12. libcap2 1:2.24-7 1
  13. lightdm 1.10.3-3blankon1 1.10.3-3
  14. mousetweaks 3.12.0-1blankon1 3.12.0-1
  15. nautilus 3.14.1-2blankon1 3.14.1-2
  16. notification-daemon 0.7.6-2blankon2 0.7.6-2
  17. notify-osd 0.9.35+14.04.20140213-0ubuntu2+blankon1 0.9.34-2
  18. ntfs-3g 1:2014.2.15AR.3-1 1
  19. policykit-1 0.110-2blankon1 0.105-8
  20. policykit-1-gnome 0.105-2blankon1 0.105-2
  21. samba 2:4.1.17+dfsg-2 2
  22. udisks2 2.1.3-5blankon1 2.1.3-5
  23. xserver-xorg-input-evdev 1:2.9.0-2 1
  24. xserver-xorg-input-vmmouse 1:13.0.0-1+b3 1
  25. xserver-xorg-video-intel 2:2.21.15-2+b2 2
less (0):
```


![image](http://g.recordit.co/6HFIFhy5gA.gif)

## early release

Still has no tests. Shame on me.

## license 
MIT
