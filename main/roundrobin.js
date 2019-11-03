module.exports = class Roundrobin {

   constructor(numSets) {
      this.numSets = Math.floor(numSets);
      this.sequence = 0;
   }

   get cycleLength() {
      return this.numSets;
   }

   setSequenceCurrentDay() {
      this.sequence = Math.floor(Date.now()/1000/24/3600);
   }

   get set() {
      return Math.floor(this.sequence % this.numSets + 1);
   }

};
