# k8s PV util
Utilities to backup, restore or initialize kubernetes persistent volumes.

----

## k8s-pv-util
 - create *VolumeSnapshots* from tagged *PersistentVolumes*
 - archive *VolumeSnapshots* to s3 compatible object stores using *k8s-pv-s3-uploader*

----

## k8s-pv-s3-uploader
 - archive and upload a *PersistentVolume* to a s3 compatible object store

----

## k8s-pv-s3-restorer
 - initialize a *PersistentVolume* using an archive from a s3 compatible object store
