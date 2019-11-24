require('log-timestamp');
const rp = require('request-promise');
const k8s = require('./k8s-util.js');

const PVC_LABEL = process.env.PVC_LABEL; // only snapshot PVCs where volumeBackup = PVC_LABEL -- default: all non-empty
const K8SAPI = process.env.K8SAPI || 'http://127.0.0.1:8001';
const DEBUG = !!process.env.DEBUG;


module.exports = class Snapshotter {

   constructor() {
      if (!K8SAPI) {
	 console.log('no K8SAPI found in env');
	 process.exit(1);
      }
   }

   createSnapshots() {
      console.log('query for PVCs ...');
      return rp(K8SAPI+'/api/v1/persistentvolumeclaims')
      .then((res) => {
	 console.log('OK');
	 DEBUG && console.log('result: '+res);
	 let o = JSON.parse(res);
	 let matchedPVCs = [];
	 o.items.forEach((pvc) => {
	    pvc.kind = 'PersistentVolumeClaim';
	    let vsLabel = pvc.metadata.labels && pvc.metadata.labels.volumeBackup;
	    if ( (PVC_LABEL && PVC_LABEL === vsLabel) || (!PVC_LABEL && vsLabel) ) {
	       matchedPVCs.push(pvc);
	    }
	 });
	 if (!matchedPVCs) {
	    console.log('no tagged PVCs found');
	 }
	 let snapshots = [];
	 matchedPVCs.forEach((pvc) => {
	    let name = pvc.metadata.name;
	    let namespace = pvc.metadata.namespace;
	    let qname = namespace+'/'+name;
	    let uuid = require('uuid/v4')(); // used to tag objects created from a run
	    let sequence = JSON.parse((pvc.metadata.annotations.volumeBackupSequence || "0")) + 1;
	    console.log('snapshotting PVC '+qname+' ...');
	    snapshots.push(rp({
	       method: 'POST',
	       uri: K8SAPI+'/apis/snapshot.storage.k8s.io/v1alpha1/namespaces/'+pvc.metadata.namespace+'/volumesnapshots',
	       body: {
		  apiVersion: 'snapshot.storage.k8s.io/v1alpha1',
		  kind: 'VolumeSnapshot',
		  metadata: {
		     name: 'volumebackup-'+uuid,
		     namespace: pvc.metadata.namespace,
		     labels: {
			volumeBackup: pvc.metadata.labels.volumeBackup
		     },
		     annotations: {
			volumeBackup: JSON.stringify({
			   resources: pvc.spec.resources,
			   volumeName: qname,
			   sequence: sequence
			})
		     }
		  },
		  spec: {
		     source: {
			name: pvc.metadata.name,
			kind: 'PersistentVolumeClaim'
		     }
		  }
	       },
	       json: true
	    })
	    .then(() => {
	       return rp({
		  method: 'PATCH',
		  uri: K8SAPI+k8s.selfLink(pvc),
		  headers: {'Content-Type': 'application/merge-patch+json'},
		  body: JSON.stringify({
		     metadata: {
			annotations: {
			   volumeBackupSequence: JSON.stringify(sequence)
			}
		     }
		  })
	       });
	    }));
	 });
	 return Promise.all(snapshots);
      })
      .then(() => {
	 console.log('snapshots created');
      })
      .catch((err) => {
	 console.log('error: '+err);
      });
   }

};
