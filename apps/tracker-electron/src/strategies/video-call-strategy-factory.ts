import { VideoCallStrategy } from './video-call-strategy.js';
import { DefaultVideoCallStrategy } from './default-video-call-strategy.js';
import { GoogleMeetStrategy } from './google-meet-strategy.js';

export class VideoCallStrategyFactory {
  private static strategies: VideoCallStrategy[] = [
    new GoogleMeetStrategy(),
    new DefaultVideoCallStrategy(),
  ];

  static getStrategy(url: string): VideoCallStrategy {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(url)) {
        console.log(`Selected strategy: ${strategy.name} for URL: ${url}`);
        return strategy;
      }
    }

    throw new Error('No suitable strategy found');
  }
}
