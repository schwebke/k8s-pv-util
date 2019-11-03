module.exports = class Hanoi {

   constructor(numSets) {
      this.numSets = Math.floor(numSets);
      this.sequence = 0;
   }

   get cycleLength() {
      return Math.floor(Math.pow(2, this.numSets-1));
   }

   setSequenceCurrentDay() {
      this.sequence = Math.floor(Date.now()/1000/24/3600);
   }

   get set() {
      let seq = Math.floor(this.sequence % this.cycleLength);
      let set = 1;
      while (set < this.numSets && (seq&1)) {
	 seq >>= 1;
	 ++set;
      }
      return set;
   }

};
