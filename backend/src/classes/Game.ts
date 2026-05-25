import { GameState, DrawStroke, Player as SharedPlayer } from '../../../shared/types';
import { Room } from './Room';
import { Player } from './Player';
import wordsData from '../data/words.json';
import { validateGuess } from '../utils/wordMatcher';

export class Game {
  private room: Room;
  public phase: GameState['phase'] = 'lobby';
  public currentRound: number = 1;
  public totalRounds: number;
  public drawerIndex: number = 0;
  
  public secretWord: string = '';
  public wordOptions: string[] = [];
  public drawTime: number;
  public timeLeft: number = 0;
  
  private timerInterval: NodeJS.Timeout | null = null;
  private selectionTimerTimeout: NodeJS.Timeout | null = null;
  
  // Track players who guessed the word in the active turn
  public correctGuessers: Set<string> = new Set();

  public wordCount: number = 3;
  public hintsSetting: number = 2;
  public wordMode: string = 'Normal';
  public hintIndices: number[] = [];

  constructor(room: Room, totalRounds: number = 3, drawTime: number = 60, wordCount: number = 3, hintsSetting: number = 2, wordMode: string = 'Normal') {
    this.room = room;
    this.totalRounds = totalRounds;
    this.drawTime = drawTime;
    this.wordCount = wordCount;
    this.hintsSetting = hintsSetting;
    this.wordMode = wordMode;
  }

  /**
   * Starts the game loop
   */
  public start() {
    this.currentRound = 1;
    this.drawerIndex = 0;
    this.startWordSelection();
  }

  /**
   * Generates 3 random words for selection
   */
  private generateWordOptions(): string[] {
    let bank: string[] = [];
    if (this.wordMode === 'Combination') {
      bank = [...wordsData.combinations];
    } else if (this.wordMode === 'Hidden') {
      bank = [...wordsData.hidden];
    } else {
      bank = [...wordsData.animals, ...wordsData.objects, ...wordsData.actions];
    }

    if (bank.length === 0) {
      bank = [...wordsData.animals, ...wordsData.objects, ...wordsData.actions];
    }

    const options: string[] = [];
    const count = Math.min(this.wordCount, bank.length);
    while (options.length < count) {
      const idx = Math.floor(Math.random() * bank.length);
      const word = bank[idx];
      if (!options.includes(word)) {
        options.push(word);
      }
    }
    return options;
  }

  /**
   * Phase 1: Drawer selects a word within 15 seconds
   */
  public startWordSelection() {
    this.phase = 'selecting_word';
    this.correctGuessers.clear();
    this.secretWord = '';
    
    // Reset all players' guess progress
    this.room.players.forEach(p => p.hasGuessed = false);

    // Get current drawer
    const drawer = this.room.players[this.drawerIndex];
    if (!drawer) {
      this.endGame();
      return;
    }

    this.wordOptions = this.generateWordOptions();
    this.timeLeft = 15;
    this.broadcastState();

    // Emit round_start (drawer gets options, others get empty options)
    this.room.players.forEach((p) => {
      const isDrawer = p.id === drawer.id;
      p.socket.emit('round_start', {
        drawerId: drawer.id,
        wordOptions: isDrawer ? this.wordOptions : [],
        drawTime: this.drawTime
      });
    });

    console.log(`⏱️ [Lobby ${this.room.id}] Word selection started for ${drawer.name}`);

    // Auto-select on timeout
    this.startCountdown(() => {
      console.log(`⌛ [Lobby ${this.room.id}] ${drawer.name} timed out choosing word. Auto-selecting.`);
      this.chooseWord(this.wordOptions[0]);
    });
  }

  /**
   * Triggered when the drawer clicks a word button
   */
  public chooseWord(chosenWord: string) {
    this.stopTimers();

    this.secretWord = chosenWord;
    this.phase = 'drawing';
    this.timeLeft = this.drawTime;

    // Seed random permutation of index locations for hints
    this.hintIndices = [];
    if (this.hintsSetting > 0) {
      const nonSpaceIndices: number[] = [];
      for (let i = 0; i < chosenWord.length; i++) {
        if (chosenWord[i] !== ' ') {
          nonSpaceIndices.push(i);
        }
      }
      // Shuffle the indices
      while (nonSpaceIndices.length > 0) {
        const randIdx = Math.floor(Math.random() * nonSpaceIndices.length);
        this.hintIndices.push(nonSpaceIndices.splice(randIdx, 1)[0]);
      }
    }
    
    this.broadcastState();
    console.log(`🎨 [Lobby ${this.room.id}] Word chosen: "${this.secretWord}". Drawing round active!`);

    // Broadcast clear stroke to wipe canvas
    this.room.broadcast('draw_data', { type: 'clear' });

    // Start drawing round clock countdown
    this.startCountdown(() => {
      console.log(`⌛ [Lobby ${this.room.id}] Drawing timer expired.`);
      this.endRound();
    });
  }

  /**
   * Processes a player's typed guess
   */
  public handleGuess(player: Player, guessText: string) {
    const drawer = this.room.players[this.drawerIndex];
    const isDrawer = player.id === drawer?.id;

    if (isDrawer && this.phase === 'drawing') {
      player.socket.emit('chat_message', {
        playerId: 'system',
        playerName: 'System',
        text: "🚫 You are the drawer! You cannot guess."
      });
      return;
    }

    if (player.hasGuessed && this.phase === 'drawing') {
      player.socket.emit('chat_message', {
        playerId: 'system',
        playerName: 'System',
        text: "🔒 You have already guessed the word!"
      });
      return;
    }

    if (this.phase === 'drawing' && this.secretWord) {
      const match = validateGuess(guessText, this.secretWord);

      if (match === 'correct') {
        player.hasGuessed = true;
        this.correctGuessers.add(player.id);

        const speedBonus = Math.round(150 * (this.timeLeft / this.drawTime));
        const scoreGained = 100 + speedBonus;
        player.score += scoreGained;

        if (drawer) {
          drawer.score += 25;
        }

        // 1. Emit guess_result to the room indicating player guessed correctly
        this.room.broadcast('guess_result', {
          correct: true,
          playerId: player.id,
          playerName: player.name,
          points: scoreGained
        });

        // 2. Broadcast system chat_message
        this.room.broadcast('chat_message', {
          playerId: 'correct',
          playerName: player.id,
          text: `💚 ${player.name} guessed the word! (+${scoreGained} pts)`
        });

        this.broadcastState();

        // End round early if all guessers got it right
        const totalGuessers = this.room.players.length - 1;
        if (this.correctGuessers.size >= totalGuessers && totalGuessers > 0) {
          console.log(`🎯 [Lobby ${this.room.id}] All players guessed the word!`);
          this.endRound();
        }
        return;
      } 
      
      else if (match === 'close') {
        // Emit private incorrect guess_result to the guesser
        player.socket.emit('guess_result', {
          correct: false,
          playerId: player.id,
          playerName: player.name,
          points: 0
        });

        // Send private "close" system warning
        player.socket.emit('chat_message', {
          playerId: 'close',
          playerName: 'System',
          text: `⚠️ "${guessText}" is so close!`
        });
        return;
      } else {
        // Emit private incorrect guess_result to the guesser
        player.socket.emit('guess_result', {
          correct: false,
          playerId: player.id,
          playerName: player.name,
          points: 0
        });
      }
    }

    // Broadcast standard chat message
    this.room.broadcast('chat_message', {
      playerId: player.id,
      playerName: player.name,
      text: guessText
    });
  }

  /**
   * Ends drawing round
   */
  public endRound() {
    this.stopTimers();
    this.phase = 'round_end';
    
    // Broadcast round_end details
    const scoresMap: Record<string, number> = {};
    this.room.players.forEach(p => scoresMap[p.id] = p.score);
    const nextDrawer = this.room.players[(this.drawerIndex + 1) % this.room.players.length];

    this.room.broadcast('round_end', {
      word: this.secretWord,
      scores: scoresMap,
      nextDrawer: nextDrawer ? nextDrawer.id : ''
    });

    this.broadcastState();
    console.log(`🔄 [Lobby ${this.room.id}] Round ended. Word was: "${this.secretWord}"`);

    // Rotate after 5 seconds
    this.selectionTimerTimeout = setTimeout(() => {
      this.rotateTurn();
    }, 5000);
  }

  /**
   * Rotates roles
   */
  private rotateTurn() {
    this.stopTimers();
    this.drawerIndex++;

    if (this.drawerIndex >= this.room.players.length) {
      this.drawerIndex = 0;
      this.currentRound++;
    }

    if (this.currentRound > this.totalRounds) {
      this.endGame();
    } else {
      this.startWordSelection();
    }
  }

  /**
   * Ends game and tallies winner
   */
  private endGame() {
    this.stopTimers();
    this.phase = 'game_over';

    if (this.room.players.length > 0) {
      const sorted = [...this.room.players].sort((a, b) => b.score - a.score);
      const winner = sorted[0];

      this.room.broadcast('chat_message', {
        playerId: 'system',
        playerName: 'System',
        text: `🏆 Game Finished! Congratulations to ${winner.name} with ${winner.score} points!`
      });

      // Emit game_over details
      this.room.broadcast('game_over', {
        winner: winner.toJSON(),
        leaderboard: sorted.map(p => p.toJSON())
      });

      this.broadcastState();
    }
  }

  /**
   * Countdown interval timer
   */
  private startCountdown(onComplete: () => void) {
    this.stopTimers();

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      
      if (this.timeLeft <= 0) {
        this.stopTimers();
        onComplete();
      } else {
        this.broadcastState();
      }
    }, 1000);
  }

  /**
   * Toggles timers
   */
  public stopTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.selectionTimerTimeout) {
      clearTimeout(this.selectionTimerTimeout);
      this.selectionTimerTimeout = null;
    }
  }

  /**
   * Serializes GameState and emits `game_state` event
   */
  public broadcastState() {
    const drawer = this.room.players[this.drawerIndex];
    
    let wordView = '';
    if (this.phase === 'drawing' && this.secretWord) {
      // Calculate how many hints to reveal if hintsSetting > 0
      let activeHintsCount = 0;
      if ((this.wordMode === 'Normal' || this.wordMode === 'Hidden') && this.hintsSetting > 0 && this.drawTime > 0) {
        const interval = this.drawTime / (this.hintsSetting + 1);
        const numHintsToReveal = Math.floor((this.drawTime - this.timeLeft) / interval);
        activeHintsCount = Math.max(0, Math.min(this.hintsSetting, numHintsToReveal));
      }

      if (this.wordMode === 'Hidden' && activeHintsCount === 0) {
        // Blanks completely hidden initially
        wordView = '❓ Hidden Word';
      } else {
        // Normal mode, Combination mode (where activeHintsCount remains 0), or Hidden mode when a hint is active
        const revealedIndices = this.hintIndices.slice(0, activeHintsCount);
        wordView = this.secretWord
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (revealedIndices.includes(index)) return char;
            return '_';
          })
          .join('');
      }
    } else if (this.phase === 'round_end' || this.phase === 'game_over') {
      wordView = this.secretWord;
    }

    const state: GameState = {
      phase: this.phase,
      round: this.currentRound,
      drawerId: drawer ? drawer.id : '',
      word: wordView,
      hints: [], // hints placeholder
      timeLeft: this.timeLeft
    };

    // Emit game_state privately, ensuring drawer gets the secret word in drawing phase
    this.room.players.forEach((p) => {
      const isDrawer = p.id === drawer?.id;
      const playerSpecificState = { ...state };

      if (isDrawer && this.phase === 'drawing') {
        playerSpecificState.word = this.secretWord;
      }

      p.socket.emit('game_state', playerSpecificState);
    });
  }
}
