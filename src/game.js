import Phaser from 'phaser';

// Portrait mobile dimensions
const GAME_W = 400;
const GAME_H = 720;

class LoadingScene extends Phaser.Scene {
  constructor() {
    super('LoadingScene');
  }

  preload() {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    this.cameras.main.setBackgroundColor('#5ba3c9');

    this.add.text(cx, cy - 100, 'Flappy Bird', {
      fontSize: '44px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Progress bar
    this.add.rectangle(cx, cy, 260, 28, 0x000000, 0.4).setOrigin(0.5);
    const bar = this.add.rectangle(cx - 128, cy, 4, 20, 0xffffff).setOrigin(0, 0.5);

    this.add.text(cx, cy + 30, 'Loading...', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.load.on('progress', (v) => bar.setSize(4 + 252 * v, 20));

    this.load.image('bg', 'assets/bg_dessert_1024x640.png');
    this.load.image('ground', 'assets/rumput_30x30.png');
    this.load.spritesheet('bird', 'assets/main_character_4frame_200x50.png', {
      frameWidth: 50,
      frameHeight: 50,
    });
    this.load.image('pilar_sheet', 'assets/pilar_2frame_100x300.png');
    this.load.audio('bgm', 'assets/sound/bgm_music.mp3');
    this.load.audio('jumpSound', 'assets/sound/flappy_bird_jump_sound.wav');
    this.load.audio('scoreSound', 'assets/sound/checkpoint_sound.wav');
    this.load.audio('crashSound', 'assets/sound/funny_flappy_bird_crash_sound.wav');
    this.load.audio('fallSound', 'assets/sound/funny_flappy_bird_fall_down_sound.wav');
  }

  create() {
    this.scene.start('GameScene');
  }
}

// Constants
const GRAVITY = 900;
const FLAP_VELOCITY = -320;
const INITIAL_PILLAR_SPEED = -180;
const INITIAL_SPAWN_MS = 1800;
const INITIAL_GAP_SIZE = 180;
const GAP_MIN_Y = 150;
const GAP_MAX_Y = GAME_H - 80 - 150;
const GROUND_HEIGHT = 30;
const BIRD_X = 100;
const BIRD_SCALE = 2;
const PILLAR_WIDTH = 60;

const STATE = { READY: 0, PLAYING: 1, GAME_OVER: 2 };

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.state = STATE.READY;
    this.score = 0;
    this.level = 0;
    this.pillarSpeed = INITIAL_PILLAR_SPEED;
    this.gapSize = INITIAL_GAP_SIZE;
    this.spawnMs = INITIAL_SPAWN_MS;
    this.bobTimer = 0;
  }

  create() {
    this.extractPilarTextures();
    this.lastGapY = GAME_H / 2;

    const cx = GAME_W / 2;

    // Background
    this.bg = this.add.tileSprite(cx, GAME_H / 2, GAME_W, GAME_H, 'bg');

    // Ground
    const groundY = GAME_H - GROUND_HEIGHT / 2;
    this.ground = this.add.tileSprite(cx, groundY, GAME_W, GROUND_HEIGHT, 'ground');
    this.ground.setDepth(5);
    this.groundBody = this.physics.add.staticImage(cx, groundY);
    this.groundBody.setDisplaySize(GAME_W, GROUND_HEIGHT);
    this.groundBody.setVisible(false);
    this.groundBody.refreshBody();

    // Ceiling
    this.ceiling = this.physics.add.staticImage(cx, -10);
    this.ceiling.setDisplaySize(GAME_W, 20);
    this.ceiling.setVisible(false);
    this.ceiling.refreshBody();

    // Bird
    const birdStartY = GAME_H / 2 - 50;
    this.bird = this.physics.add.sprite(BIRD_X, birdStartY, 'bird');
    this.bird.setScale(BIRD_SCALE);
    this.bird.setCollideWorldBounds(false);
    this.bird.body.setAllowGravity(false);
    this.bird.setDepth(10);
    this.bird.body.setSize(38, 38);
    this.bird.body.setOffset(6, 6);

    this.anims.create({
      key: 'flap',
      frames: this.anims.generateFrameNumbers('bird', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });
    this.bird.play('flap');
    this.birdStartY = birdStartY;

    // Pillar groups — use plain groups, we manage physics manually
    this.pillars = this.add.group();
    this.scoreZones = this.add.group();

    // Score text
    this.scoreText = this.add.text(cx, 60, '0', {
      fontSize: '52px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20);
    this.scoreText.setVisible(false);

    // Message text
    this.messageText = this.add.text(cx, GAME_H / 2 - 80, 'Tap or Press Space\nto Start', {
      fontSize: '26px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(20);

    // Watermark
    this.add.text(cx, GAME_H - 50, 'Made by Muhammad Adil', {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      alpha: 0.7,
    }).setOrigin(0.5).setDepth(20);

    this.add.text(cx, GAME_H - 32, 'github.com/iniadi', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#aaddff',
      stroke: '#000000',
      strokeThickness: 2,
      alpha: 0.7,
    }).setOrigin(0.5).setDepth(20);

    // Level up text
    this.levelUpText = this.add.text(cx, 130, 'Level Up!', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Game over texts
    this.gameOverText = this.add.text(cx, GAME_H / 2 - 60, '', {
      fontSize: '36px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this.restartText = this.add.text(cx, GAME_H / 2 + 30, 'Tap or Press Space\nto Restart', {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Input
    this.input.on('pointerdown', () => this.handleInput());
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.spaceKey.on('down', () => this.handleInput());

    // Colliders — set up with groups
    this.physics.add.collider(this.bird, this.groundBody, () => this.hitGround());
    this.physics.add.collider(this.bird, this.ceiling);

    // Pillar spawn timer
    this.pillarTimer = this.time.addEvent({
      delay: this.spawnMs,
      callback: this.spawnPillarPair,
      callbackScope: this,
      loop: true,
      paused: true,
    });

    // Audio
    this.bgm = this.sound.add('bgm', { loop: true, volume: 0.3 });
    this.jumpSfx = this.sound.add('jumpSound', { volume: 0.5 });
    this.scoreSfx = this.sound.add('scoreSound', { volume: 0.6 });
    this.crashSfx = this.sound.add('crashSound', { volume: 0.7 });
    this.fallSfx = this.sound.add('fallSound', { volume: 0.7 });
  }


  update(_time, delta) {
    this.bg.tilePositionX += 0.5;

    if (this.state === STATE.READY) {
      this.bobTimer += delta;
      this.bird.y = this.birdStartY + Math.sin(this.bobTimer / 300) * 15;
    }

    if (this.state === STATE.PLAYING) {
      this.ground.tilePositionX += Math.abs(this.pillarSpeed) * (delta / 1000);

      // Bird rotation
      const angle = Phaser.Math.Clamp(this.bird.body.velocity.y / 10, -30, 90);
      this.bird.setAngle(angle);

      // Move pillars and score zones manually, check collisions
      this.updatePillars(delta);
    }
  }

  extractPilarTextures() {
    const source = this.textures.get('pilar_sheet').getSourceImage();

    // Shaft: kiri 40px, full 300px tinggi
    const cs = document.createElement('canvas');
    cs.width = 40; cs.height = 300;
    cs.getContext('2d').drawImage(source, 0, 0, 40, 300, 0, 0, 40, 300);
    this.textures.addCanvas('pilar_shaft', cs);

    // Cap: kanan 60px, hanya 50px teratas
    const cc = document.createElement('canvas');
    cc.width = 60; cc.height = 50;
    cc.getContext('2d').drawImage(source, 40, 0, 60, 50, 0, 0, 60, 50);
    this.textures.addCanvas('pilar_cap', cc);
  }

  createPillarColumn(x, y, height, isTop) {
    const CAP_H = 50;
    const container = this.add.container(x, y);
    container.setDepth(2);
    container.isTop = isTop;
    container.pillarHeight = height;

    const shaftHeight = Math.max(0, height - CAP_H);

    // Cap di sisi gap (bawah untuk top, atas untuk bottom)
    const capLocalY = isTop ? height / 2 - CAP_H / 2 : -height / 2 + CAP_H / 2;
    const cap = this.add.image(0, capLocalY, 'pilar_cap');
    cap.setDisplaySize(60, CAP_H);
    if (isTop) cap.setFlipY(true);
    container.add(cap);

    // Shaft mengisi sisa tinggi — overlap 2px ke arah cap agar tidak ada gap
    if (shaftHeight > 0) {
      const overlap = 2;
      const shaftLocalY = isTop ? -CAP_H / 2 + overlap : CAP_H / 2 - overlap;
      const shaft = this.add.tileSprite(0, shaftLocalY, 40, shaftHeight + overlap, 'pilar_shaft');
      container.add(shaft);
    }

    return container;
  }

  updatePillars(delta) {
    const speed = this.pillarSpeed * (delta / 1000);

    // Move and check pillars
    const pillarsToRemove = [];
    this.pillars.getChildren().forEach(pillar => {
      pillar.x += speed;

      // Check collision with bird
      if (this.state === STATE.PLAYING && this.checkOverlap(this.bird, pillar)) {
        this.hitPillar();
      }

      if (pillar.x < -PILLAR_WIDTH) {
        pillarsToRemove.push(pillar);
      }
    });
    pillarsToRemove.forEach(p => p.destroy());

    // Move and check score zones
    const zonesToRemove = [];
    this.scoreZones.getChildren().forEach(zone => {
      zone.x += speed;

      if (!zone.scored && this.state === STATE.PLAYING && this.checkScoreZone(this.bird, zone)) {
        this.incrementScore(zone);
      }

      if (zone.x < -PILLAR_WIDTH) {
        zonesToRemove.push(zone);
      }
    });
    zonesToRemove.forEach(z => z.destroy());
  }

  checkScoreZone(bird, zone) {
    // No inset — zone is just 10px wide, use full bounds
    return Phaser.Geom.Intersects.RectangleToRectangle(
      bird.getBounds(),
      new Phaser.Geom.Rectangle(zone.x - 5, zone.y - zone.height / 2, 10, zone.height)
    );
  }

  checkOverlap(bird, pillar) {
    const CAP_W = 60;
    const CAP_H = 50;
    const SHAFT_W = 40;
    const { x, y, pillarHeight, isTop } = pillar;

    // Bird hitbox — inset dari 100x100 display
    const bb = bird.getBounds();
    const bi = 20;
    const birdRect = new Phaser.Geom.Rectangle(bb.x + bi, bb.y + bi, bb.width - bi * 2, bb.height - bi * 2);

    // Cap rect — inset agar sentuhan ringan di tepi masih aman
    const capCY = isTop ? y + pillarHeight / 2 - CAP_H / 2 : y - pillarHeight / 2 + CAP_H / 2;
    const capIX = 10; // inset horizontal cap
    const capIY = 8;  // inset sisi gap (atas/bawah cap)
    const capRect = new Phaser.Geom.Rectangle(
      x - CAP_W / 2 + capIX,
      capCY - CAP_H / 2 + (isTop ? capIY : 0),
      CAP_W - capIX * 2,
      CAP_H - capIY
    );

    // Shaft rect — inset horizontal, shaft sudah sempit (40px)
    const shaftHeight = Math.max(0, pillarHeight - CAP_H);
    const shaftCY = isTop ? y - CAP_H / 2 : y + CAP_H / 2;
    const shaftIX = 6;
    const shaftRect = new Phaser.Geom.Rectangle(x - SHAFT_W / 2 + shaftIX, shaftCY - shaftHeight / 2, SHAFT_W - shaftIX * 2, shaftHeight);

    return (
      Phaser.Geom.Intersects.RectangleToRectangle(birdRect, capRect) ||
      Phaser.Geom.Intersects.RectangleToRectangle(birdRect, shaftRect)
    );
  }

  handleInput() {
    if (this.state === STATE.READY) {
      this.startGame();
    } else if (this.state === STATE.PLAYING) {
      this.flapBird();
    } else if (this.state === STATE.GAME_OVER) {
      this.restartGame();
    }
  }

  startGame() {
    this.physics.resume();
    this.state = STATE.PLAYING;
    this.messageText.setVisible(false);
    this.scoreText.setVisible(true);

    // Reset posisi bird dari bobbing ke posisi bersih sebelum physics aktif
    this.bird.body.reset(BIRD_X, this.birdStartY);
    this.bird.body.setAllowGravity(true);
    this.bird.body.setGravityY(GRAVITY);
    this.flapBird();

    this.pillarTimer.paused = false;
    this.spawnPillarPair();

    this.bgm.play();
  }

  flapBird() {
    this.bird.setVelocityY(FLAP_VELOCITY);
    this.jumpSfx.play();
  }

  spawnPillarPair() {
    if (this.state !== STATE.PLAYING) return;

    const spawnX = GAME_W + PILLAR_WIDTH / 2;
    const maxDelta = 130;
    const minY = Math.max(GAP_MIN_Y, this.lastGapY - maxDelta);
    const maxY = Math.min(GAP_MAX_Y, this.lastGapY + maxDelta);
    const gapCenterY = Phaser.Math.Between(minY, maxY);
    this.lastGapY = gapCenterY;
    const groundTop = GAME_H - GROUND_HEIGHT;

    // Top pillar
    const topHeight = gapCenterY - this.gapSize / 2;
    if (topHeight > 0) {
      this.pillars.add(this.createPillarColumn(spawnX, topHeight / 2, topHeight, true));
    }

    // Bottom pillar
    const bottomY = gapCenterY + this.gapSize / 2;
    const bottomHeight = groundTop - bottomY;
    if (bottomHeight > 0) {
      this.pillars.add(this.createPillarColumn(spawnX, bottomY + bottomHeight / 2, bottomHeight, false));
    }

    // Score zone — invisible rectangle in the gap
    const scoreZone = this.add.zone(spawnX, gapCenterY, 10, this.gapSize);
    scoreZone.scored = false;
    this.scoreZones.add(scoreZone);
  }

  incrementScore(zone) {
    if (zone.scored) return;
    zone.scored = true;

    this.score++;
    this.scoreText.setText(this.score.toString());

    // Difficulty scaling every 5 points
    const newLevel = Math.floor(this.score / 5);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.pillarSpeed = INITIAL_PILLAR_SPEED - (this.level * 20);
      this.gapSize = Math.max(120, INITIAL_GAP_SIZE - (this.level * 10));
      this.spawnMs = Math.max(1000, INITIAL_SPAWN_MS - (this.level * 150));

      this.pillarTimer.delay = this.spawnMs;

      this.scoreSfx.stop();
      this.scoreSfx.play();

      this.levelUpText.setText(`Level ${this.level + 1}!`);
      this.levelUpText.setVisible(true).setAlpha(1);
      this.tweens.add({
        targets: this.levelUpText,
        alpha: 0,
        duration: 1500,
        onComplete: () => this.levelUpText.setVisible(false),
      });
    }
  }

  hitPillar() {
    if (this.state === STATE.GAME_OVER) return;
    this.crashSfx.play();
    this.triggerGameOver();
  }

  hitGround() {
    if (this.state === STATE.GAME_OVER) return;
    this.fallSfx.play();
    this.triggerGameOver();
  }

  triggerGameOver() {
    if (this.state === STATE.GAME_OVER) return;
    this.state = STATE.GAME_OVER;

    this.physics.pause();
    this.bird.setTint(0xff0000);
    this.bird.anims.stop();
    this.pillarTimer.paused = true;
    this.bgm.stop();

    this.gameOverText.setText(`Game Over!\nScore: ${this.score}`).setVisible(true);
    this.restartText.setVisible(true);
  }

  restartGame() {
    this.state = STATE.READY;
    this.score = 0;
    this.level = 0;
    this.pillarSpeed = INITIAL_PILLAR_SPEED;
    this.gapSize = INITIAL_GAP_SIZE;
    this.spawnMs = INITIAL_SPAWN_MS;
    this.bobTimer = 0;

    this.scene.restart();
  }
}

const config = {
  type: Phaser.AUTO,
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [LoadingScene, GameScene],
};

new Phaser.Game(config);
