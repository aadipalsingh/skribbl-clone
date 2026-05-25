import { Socket } from 'socket.io';
import { Player as SharedPlayer } from '../../../shared/types';

export class Player implements SharedPlayer {
  public id: string;
  public name: string;
  public score: number = 0;
  public avatar: string;
  public isHost: boolean = false;
  
  // Track round-specific state
  public hasGuessed: boolean = false;
  public socket: Socket;

  constructor(socket: Socket, name: string, avatar: string, isHost: boolean = false) {
    this.socket = socket;
    this.id = socket.id;
    this.name = name;
    this.avatar = avatar;
    this.isHost = isHost;
  }

  /**
   * Serializes the player class into a clean data object to send over WebSockets safely.
   * This excludes the heavy native circular Socket reference!
   */
  public toJSON(): SharedPlayer {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      avatar: this.avatar,
      isHost: this.isHost,
    };
  }
}
