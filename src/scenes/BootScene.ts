import Phaser from 'phaser';



export class BootScene extends Phaser.Scene {

  constructor() {

    super('BootScene');

  }



  preload(): void {

    this.load.setBaseURL('./');

  }



  create(): void {

    this.scene.start('MenuScene');

  }

}


