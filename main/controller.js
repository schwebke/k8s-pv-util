require('log-timestamp');
const rp = require('request-promise');
const k8s = require('./k8s-util.js');
const Hanoi = require('./hanoi.js');
const Roundrobin = require('./roundrobin.js');

const PVC_LABEL = process.env.PVC_LABEL; // only snapshot PVCs where volumeBackup = PVC_LABEL -- default: all non-empty
const K8SAPI = process.env.K8SAPI || 'http://127.0.0.1:8001';
const NUM_BACKUP_SETS = process.env.NUM_BACKUP_SETS || 5;
const BACKUP_SET_STRATEGY = process.env.BACKUP_SET_STRATEGY || 'hanoi';
const SECRET_S3CFG = process.env.SECRET_S3CFG || "volume-backup-s3cfg";
const S3BASEURL = process.env.S3BASEURL;
const DEBUG = !!process.env.DEBUG;


// Towers of Hanoi backup rotation scheme

module.exports = class Controller {

   constructor() {
      if (!K8SAPI) {
	 console.log('no K8SAPI found in env');
	 process.exit(1);
      }

      if (!S3BASEURL) {
	 console.log('no S3BASEURL found in env');
	 process.exit(1);
      }

      if (BACKUP_SET_STRATEGY === 'hanoi') {
	 this.backupSetStrategy = new Hanoi(parseInt(NUM_BACKUP_SETS, 10));
      } else if (BACKUP_SET_STRATEGY === 'roundrobin') {
	 this.backupSetStrategy = new Roundrobin(parseInt(NUM_BACKUP_SETS, 10));
      } else {
	 console.log('unknown BACKUP_SET_STRATEGY '+BACKUP_SET_STRATEGY);
	 process.exit(1);
      }
      console.log("using "+this.backupSetStrategy.numSets+" backup sets with strategy "+BACKUP_SET_STRATEGY);
   }

   async claimSnapshots() {
      DEBUG && console.log('');
      DEBUG && console.log('claim snapshots');
      DEBUG && console.log('query for existings PVCs / already claimed VS ...');
      let existingClaims = [];
      let res = await rp(K8SAPI+'/api/v1/persistentvolumeclaims');
      DEBUG && console.log('get PVCs OK');
      DEBUG && console.log('result: '+res);
      let o = JSON.parse(res);
      o.items.forEach((pvc) => {
	 let vsLabel = pvc.metadata.labels && pvc.metadata.labels.volumeBackupSnapshotClaim;
	 if (vsLabel) { // existing PVC
	    existingClaims.push(pvc.spec.dataSource.name);
	 }
      });
      DEBUG && console.log('existing PVCs for snapshots: '+JSON.stringify(existingClaims));
      DEBUG && console.log('query for VolumeSnapshots ...');

      res = await rp(K8SAPI+'/apis/snapshot.storage.k8s.io/v1alpha1/volumesnapshots');
      DEBUG && console.log('get VolumeSnapshots OK');
      DEBUG && console.log('result: '+res);
      o = JSON.parse(res);
      let matchedVSs = [];
      o.items.forEach((vs) => {
	 let vsLabel = vs.metadata.labels && vs.metadata.labels.volumeBackup;
	 if ( (PVC_LABEL && PVC_LABEL === vsLabel) || (!PVC_LABEL && vsLabel) ) {
	    if (!existingClaims.includes(vs.metadata.name)) {
	       DEBUG && console.log('unclaimed VS '+vs.metadata.name);
	       matchedVSs.push(vs);
	    } else {
	       DEBUG && console.log('VS '+vs.metadata.name+' already claimed');
	    }
	 }
      });
      let claims = [];
      matchedVSs.forEach((vs) => {
	 let name = vs.metadata.name;
	 let namespace = vs.metadata.namespace;
	 let qname = namespace+'/'+name;
	 console.log('claiming VS '+qname+' ...');
	 claims.push(rp({
	    method: 'POST',
	    uri: K8SAPI+'/api/v1/namespaces/'+vs.metadata.namespace+'/persistentvolumeclaims',
	    body: {
	       apiVersion: 'v1',
	       kind: 'PersistentVolumeClaim',
	       metadata: {
		  name: vs.metadata.name,
		  namespace: vs.metadata.namespace,
		  labels: {
		     volumeBackupSnapshotClaim: vs.metadata.labels.volumeBackup
		  },
		  annotations: {
		     volumeBackup: vs.metadata.annotations.volumeBackup
		  }
	       },
	       spec: {
		  dataSource: {
		     name: vs.metadata.name,
		     kind: 'VolumeSnapshot',
		     apiGroup: 'snapshot.storage.k8s.io'
		  },
		  accessModes: ['ReadWriteOnce'],
		  resources: JSON.parse(vs.metadata.annotations.volumeBackup).resources
	       }
	    },
	    json: true
	 }));
      });
      await Promise.all(claims);
      DEBUG && console.log('claiming done');
   }

   async backupJobs() {
      DEBUG && console.log('');
      DEBUG && console.log('backup jobs');
      DEBUG && console.log("using backup set "+this.backupSetStrategy.set);
      DEBUG && console.log('query for existing jobs ...');
      let existingJobs = [];
      let res = await rp(K8SAPI+'/apis/batch/v1/jobs');
      DEBUG && console.log('get jobs OK');
      DEBUG && console.log('result: '+res);
      let o = JSON.parse(res);
      o.items.forEach((job) => {
	 let jobLabel = job.metadata.labels && job.metadata.labels.volumeBackup;
	 if (jobLabel) { // existing job for PVC
	    existingJobs.push(job.metadata.annotations.volumeBackupSnapshotClaim);
	 }
      });
      DEBUG && console.log('existing jobs for PVCs: '+JSON.stringify(existingJobs));
      DEBUG && console.log('query for PVCs ...');

      res = await rp(K8SAPI+'/api/v1/persistentvolumeclaims');
      DEBUG && console.log('get PVCs OK');
      DEBUG && console.log('result: '+res);
      o = JSON.parse(res);
      let matchedPVCs = [];
      o.items.forEach((pvc) => {
	 let vsLabel = pvc.metadata.labels && pvc.metadata.labels.volumeBackupSnapshotClaim;
	 if ( (PVC_LABEL && PVC_LABEL === vsLabel) || (!PVC_LABEL && vsLabel) ) {
	    if (!existingJobs.includes(pvc.metadata.name)) {
	       console.log('PVC without job: '+pvc.metadata.name);
	       matchedPVCs.push(pvc);
	    } else {
	       DEBUG && console.log('PVC '+pvc.metadata.name+' already has a job');
	    }
	 }
      });
      let jobs = [];
      matchedPVCs.forEach((pvc) => {
	 let name = pvc.metadata.name;
	 let namespace = pvc.metadata.namespace;
	 let qname = namespace+'/'+name;
	 let origVolumeName = JSON.parse(pvc.metadata.annotations.volumeBackup).volumeName;
	 this.backupSetStrategy.sequence = JSON.parse(pvc.metadata.annotations.volumeBackup).sequence;
	 console.log('creating job for PVC '+qname+', sequence '+this.backupSetStrategy.sequence+' ...');
	 jobs.push(rp({
	    method: 'POST',
	    uri: K8SAPI+'/apis/batch/v1/namespaces/'+pvc.metadata.namespace+'/jobs',
	    body: {
	       apiVersion: "batch/v1",
	       kind: "Job",
	       metadata: {
		  name: name,
		  namespace: pvc.metadata.namespace,
		  labels: {
		     volumeBackup: pvc.metadata.labels.volumeBackupSnapshotClaim
		  },
		  annotations: {
		     volumeBackupSnapshotClaim: pvc.metadata.name
		  }
	       },
	       spec: {
		  template: {
		     spec: {
			containers: [
			   {
			      image: "schwebke/k8s-pv-s3-uploader:latest",
			      name: "volume-backup-uploader",
			      env: [
				 {
				    "name": "S3URL",
				    "value": S3BASEURL+'/'+origVolumeName+'/'+this.backupSetStrategy.set+'.tar.gz'
				 }
			      ],
			      resources: {
				 requests: {
				    memory: "100Mi",
				    cpu: "750m"
				 },
				 limits: {
				    memory: "200Mi",
				    cpu: "1000m"
				 }
			      },
			      volumeMounts: [
				 {
				    name: "snapshot-pv",
				    mountPath: "/snapshot"
				 },
				 {
				    name: "s3cfg",
				    mountPath: "/config",
				    readOnly: true
				 }
			      ]
			   }
			],
			restartPolicy: "Never",
			volumes: [
			   {
			      name: "snapshot-pv",
			      persistentVolumeClaim: {
				 "claimName": pvc.metadata.name
			      }
			   },
			   {
			      name: "s3cfg",
			      secret: {
				 secretName: SECRET_S3CFG
			      }
			   }
			]
		     }
		  }
	       }
	    },
	    json: true
	 }));
      });
      await Promise.all(jobs);
      DEBUG && console.log('jobs done');
   }

   async cleanup() {
      DEBUG && console.log('');
      DEBUG && console.log('cleanup');
      // delete / cleanup for succeeded jobs in this order -- then no re-creation happens
      let volumeSnapshots = [];
      let PVCs = [];
      // let pods = []; -- dynamic with selector
      let jobs = [];

      DEBUG && console.log('query for VolumeSnapshots ...');
      let res = await rp(K8SAPI+'/apis/snapshot.storage.k8s.io/v1alpha1/volumesnapshots');
      DEBUG && console.log('get VolumeSnapshots OK');
      DEBUG && console.log('result: '+res);
      let o = JSON.parse(res);
      o.items.forEach((vs) => {
	 vs.kind = 'VolumeSnapshot';
	 let vsLabel = vs.metadata.labels && vs.metadata.labels.volumeBackup;
	 if ( (PVC_LABEL && PVC_LABEL === vsLabel) || (!PVC_LABEL && vsLabel) ) {
	    volumeSnapshots.push(vs);
	 }
      });
      DEBUG && console.log('query for PVCs ...');

      res = await rp(K8SAPI+'/api/v1/persistentvolumeclaims');
      DEBUG && console.log('get PVCs OK');
      DEBUG && console.log('result: '+res);
      o = JSON.parse(res);
      o.items.forEach((pvc) => {
	 pvc.kind = 'PersistentVolumeClaim';
	 let pvcLabel = pvc.metadata.labels && pvc.metadata.labels.volumeBackupSnapshotClaim;
	 if ( (PVC_LABEL && PVC_LABEL === pvcLabel) || (!PVC_LABEL && pvcLabel) ) {
	    if (!pvc.metadata.deletionTimestamp) {
	       PVCs.push(pvc);
	    }
	 }
      });
      DEBUG && console.log('query for jobs ...');

      res = await rp(K8SAPI+'/apis/batch/v1/jobs');
      DEBUG && console.log('get jobs OK');
      DEBUG && console.log('result: '+res);
      o = JSON.parse(res);
      o.items.forEach((job) => {
	 job.kind = 'Job';
	 let jobLabel = job.metadata.labels && job.metadata.labels.volumeBackup;
	 if ( (PVC_LABEL && PVC_LABEL === jobLabel) || (!PVC_LABEL && jobLabel) ) {
	    if (job.status && job.status.succeeded) {
	       jobs.push(job);
	    }
	 }
      });

      let jobPromises = [];
      jobs.forEach((job) => {
	 console.log('cleanup for succeeded job '+job.metadata.name);
	 let pvc = PVCs.find((pvc) => {
	    return pvc.metadata.name === job.metadata.annotations.volumeBackupSnapshotClaim;
	 });
	 if (pvc) {
	    console.log('cleanup job PVC: '+pvc.metadata.name);
	    let vs = volumeSnapshots.find((vs) => {
	       return vs.metadata.name === pvc.spec.dataSource.name;
	    });
	    if (vs) {
	       console.log('cleanup job PVC VolumeSnapshot: '+vs.metadata.name);
	       jobPromises.push(rp({ method: 'DELETE', uri: K8SAPI+k8s.selfLink(vs) })
	       .then(() => {
		  console.log('VolumeSnapshot '+vs.metadata.name+' deleted');
	       })
	       .catch((err) => {
		  console.log('error: '+err);
	       }));
	    } else {
	       console.log('no VolumeSnapshot found, cleanup PVC');
	       jobPromises.push(rp({ method: 'DELETE', uri: K8SAPI+k8s.selfLink(pvc) })
	       .then(() => {
		  console.log('PVC '+pvc.metadata.name+' deleted');
	       })
	       .catch((err) => {
		  console.log('error: '+err);
	       }));
	    }
	 } else {
	    console.log('no PVC found, cleanup job and pods');
	    jobPromises.push(rp({
	       method: 'GET',
	       uri: K8SAPI+'/api/v1/namespaces/'+job.metadata.namespace+'/pods/?labelSelector=job-name%3D'+job.metadata.name,
	       json: true
	    })
	    .then((pods) => {
	       let cleanupPods = [];
	       pods.items.forEach((pod) => {
		  pod.kind = 'Pod';
		  cleanupPods.push(
			rp(K8SAPI+k8s.selfLink(pod)+'/log')
			.then((log) => {
			   console.log('logs from pod '+pod.metadata.namespace+'/'+pod.metadata.name);
			   console.log('--------------------------------------------------------------------------------');
			   console.log(log);
			   console.log('--------------------------------------------------------------------------------');
			})
			.finally(() => {
			   return rp({
			      method: 'DELETE',
			      uri: K8SAPI+k8s.selfLink(pod)
			   });
			})
		     );
	       });
	       return Promise.all(cleanupPods);
	    })
	    .then(() => {
	       return rp({ method: 'DELETE', uri: K8SAPI+k8s.selfLink(job) });
	    })
	    .then(() => {
	       console.log('job '+job.metadata.name+' deleted');
	    })
	    .catch((err) => {
	       console.log('error: '+err);
	    }));
	 }
      });
      await Promise.all(jobPromises);
   }

};
