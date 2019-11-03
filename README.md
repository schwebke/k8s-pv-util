# k8s PV util
Utilities to backup, restore or initialize kubernetes persistent volumes.

----

## k8s-pv-util

[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/schwebke/k8s-pv-util)](https://hub.docker.com/r/schwebke/k8s-pv-util)

[`docker pull schwebke/k8s-pv-util`](https://hub.docker.com/r/schwebke/k8s-pv-util)

 - create *VolumeSnapshots* from tagged *PersistentVolumes*
 - archive *VolumeSnapshots* to s3 compatible object stores using *k8s-pv-s3-uploader*

### Volumes
This container does not use explicit volumes.

To manage kubernetes API objects like *VolumeSnapshots* or *Jobs*,
API access is proxied via `kubectl proxy`. To authenticate to the
apiserver, a service account must be assigned to the Pod and
the corresponding token being accessible to `kubectl`.
This is the default behaviour, see also
[kubernetes.io -- Accessing the API from a Pod](https://kubernetes.io/docs/tasks/access-application-cluster/access-cluster/#accessing-the-api-from-a-pod).

A suitable *ServiceAccount* named `k8s-pv-util-sa` in `default` namespace with *ClusterRole* and *ClusterRoleBinding*
is provided in [./kubernetes/k8s-pv-util-sa.yaml](https://github.com/schwebke/k8s-pv-util/blob/master/kubernetes/k8s-pv-util-sa.yaml).


### Environment

This container supports different main operation modes:

 - In `snapshot` mode, intended to be used in `CronJobs`, *VolumeSnapshots* are created from *PersistentVolumeClaims*.
   This is done once, then the container exits.

 - In `controller` mode, intended to be used in a `Deployment`, *VolumeSnapshots* are claimed, archived to a s3 compatible
   object store using a backup strategy to keep only a certain amount of history and finally cleaned up.
   This is done cyclic in a control loop, the container stays active until terminated.


#### Snapshot Mode

| Variable                 | Description / Value                  | required                 | default                 |
| ------------------------ | ------------------------------------ | ------------------------ | ----------------------- |
| `MODE`                   | `snapshot`                           | yes                      |                         |
| `K8SAPI`                 | URL of k8s API proxy                 | no                       | `http://127.0.0.1:8001` |
| `PVC_LABEL`              | `volumeBackup` label value           | no                       | *all non-empty values*  |
| `DEBUG`                  | verborse logging                     | no                       | false                   |

Only *PersistentVolumes* tagged with a `volumeBackup` label are processed.
By default the label value does not matter. If multiple sets of volumes should be treated differently,
for example with multiple *CronJobs* using different schedules, the value of the `volumeBackup`
can be specified -- then only *PersistentVolumes* with an exact match for the label value are snapshotted.


#### Controller Mode

| Variable                 | Description / Value                  | required                 | default                 |
| ------------------------ | ------------------------------------ | ------------------------ | ----------------------- |
| `MODE`                   | `controller`                         | yes                      |                         |
| `K8SAPI`                 | URL of k8s API proxy                 | no                       | `http://127.0.0.1:8001` |
| `PVC_LABEL`              | `volumeBackup` label value           | no                       | *all non-empty values*  |
| `CHECK_INTERVAL`         | check/reconcile interval in seconds  | no                       | 120                     |
| `DEBUG`                  | verborse logging                     | no                       | false                   |
| `NUM_BACKUP_SETS`        | max. number of backups in archive    | no                       | 5                       |
| `BACKUP_SET_STRATEGY`    | `hanoi` or `roundrobin`              | no                       | `hanoi`                 |
| `SECRET_S3CFG`           | secret with `s3cfg` config file      | yes                      |                         |
| `S3BASEURL`              | s3 base URL                          | yes                      |                         |

Only *PersistentVolumes* tagged with a `volumeBackup` label or processed.
By default the label value does not matter. If multiple sets of volumes should be treated differently,
for example with different s3 object store configurations, the value of the `volumeBackup`
can be specified -- then only *PersistentVolumes* with an exact match for the label value are processed.

Only the specified number of backup sets per volume is kept in the s3 object store.
Older backups are subsequently overwritten.
The default backup rotation scheme is
[Tower of Hanoi](https://en.wikipedia.org/wiki/Backup_rotation_scheme#Tower_of_Hanoi).
With 5 backup sets this results in a histroy dating back up to 32 cycles, with growing intervals.
With the `roundrobin` scheme every cycle is retained until the max. number of sets is reached.
The cycle number is generated from an attribute created and maintained in the originating *PersistentVolumeClaim*.

The volume data is archived using `tar` with `gzip` compression to the object store.
The kubernetes namespace and name of the originating volume is appended to the s3 base URL resulting
in object names like `s3://my-object-store/my-base-path-component/my-k8s-namespace/my-k8s-volname/1.tar.gz`
for a base path `s3://my-object-store/my-base-path-component`.

----

## k8s-pv-s3-uploader

[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/schwebke/k8s-pv-s3-uploader)](https://hub.docker.com/r/schwebke/k8s-pv-s3-uploader)

[`docker pull schwebke/k8s-pv-s3-uploader`](https://hub.docker.com/r/schwebke/k8s-pv-s3-uploader)

 - archive and upload a *PersistentVolume* to a s3 compatible object store

Uploads volume data to the given s3 object store url and exits after completion.

The object store is accessed via [s3cmd](https://s3tools.org/s3cmd).
The `.s3cfg` config file has to be provided in `/config/s3cfg` (note the missing .).

*k8s-pv-util* in *controller* mode creates *Jobs* with this container to upload the claimed snapshot
to the object store.


### Volumes

| Path      | Contents                        |
| --------- | ------------------------------- |
| /config   | `s3cfg` config file for `s3cmd` |
| /snapshot | source volume to archive        |


### Environment

| Variable                 | Description / Value                  | required                 | default                 |
| ------------------------ | ------------------------------------ | ------------------------ | ----------------------- |
| `S3URL`                  | s3 target URL, passed to `s3cmd`     | yes                      |                         |


----

## k8s-pv-s3-restorer

[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/schwebke/k8s-pv-s3-restorer)](https://hub.docker.com/r/schwebke/k8s-pv-s3-restorer)

[`docker pull schwebke/k8s-pv-s3-restorer`](https://hub.docker.com/r/schwebke/k8s-pv-s3-restorer)

 - initialize a *PersistentVolume* using an archive from a s3 compatible object store

Download volume data from the given s3 object store URL as `.tar.gz` archive,
extract it into the empty volume and exist after completion.

In case the target volume is not empty, the container exists successfully without doing anything.

Due to this behaviour, this container can be used as an [Init Container](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/)
to pre-populate an empty `PersistentVolume`. Subsequent runs of the container will not overwrite
already existing contents.

Besides restoring a backup created with *k8s-pv-util*, this container can also be used for migrations
from non-kubernetes environments, pre-configurations and so on -- just create a `.tar.gz` file,
upload it to the volume store and configure it as source for `k8s-pv-restorer`.

As this container is detecting existing data, the volume contents are not overwritten in subsequent runs.
An exception is a retry of the first run on an empty volume. To detect an aborted restore,
an empty file named `.volume-backup-in-progress` is placed in the volume and deleted only after
succesfully extracting the archive. The presence of this file indicates that the contents of
the volume can be safely overwritten.


### Volumes

| Path      | Contents                        |
| --------- | ------------------------------- |
| /config   | `s3cfg` config file for `s3cmd` |
| /volume   | target volume to extract to     |


### Environment

| Variable                 | Description / Value                  | required                 | default                 |
| ------------------------ | ------------------------------------ | ------------------------ | ----------------------- |
| `S3URL`                  | s3 source URL, passed to `s3cmd`     | yes                      |                         |


