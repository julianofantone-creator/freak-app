// Analytics Configuration for Freaky App
import mixpanel from 'mixpanel-browser';
import { gtag } from 'ga-gtag';

// Initialize Google Analytics
const GA_MEASUREMENT_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development';

// Google Analytics setup
if (GA_MEASUREMENT_ID && import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
  gtag('config', GA_MEASUREMENT_ID, {
    page_title: 'Freaky Video Chat',
    page_location: window.location.href,
    debug_mode: ENVIRONMENT !== 'production'
  });
}

// Mixpanel setup
if (MIXPANEL_TOKEN && import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: ENVIRONMENT !== 'production',
    track_pageview: true,
    persistence: 'localStorage',
    ip: false, // Don't track IP for privacy
    property_blacklist: ['$current_url'] // Privacy compliance
  });
}

// Analytics wrapper class
class Analytics {
  constructor() {
    this.enabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';
    this.userId = null;
  }

  // Set user identity
  identify(userId, traits = {}) {
    if (!this.enabled) return;
    
    this.userId = userId;
    
    // Google Analytics
    if (GA_MEASUREMENT_ID) {
      gtag('config', GA_MEASUREMENT_ID, {
        user_id: userId,
        custom_map: { dimension1: 'user_type' }
      });
    }
    
    // Mixpanel
    if (MIXPANEL_TOKEN) {
      mixpanel.identify(userId);
      mixpanel.people.set({
        $name: traits.name,
        $email: traits.email,
        $created: new Date().toISOString(),
        user_type: traits.userType || 'free',
        ...traits
      });
    }
  }

  // Track events
  track(eventName, properties = {}) {
    if (!this.enabled) return;

    const eventData = {
      ...properties,
      timestamp: new Date().toISOString(),
      user_id: this.userId,
      environment: ENVIRONMENT
    };

    // Google Analytics
    if (GA_MEASUREMENT_ID) {
      gtag('event', eventName, {
        event_category: properties.category || 'engagement',
        event_label: properties.label,
        value: properties.value,
        custom_parameters: eventData
      });
    }

    // Mixpanel
    if (MIXPANEL_TOKEN) {
      mixpanel.track(eventName, eventData);
    }

    // Console log in development
    if (ENVIRONMENT !== 'production') {
      console.log('Analytics Event:', eventName, eventData);
    }
  }

  // Track page views
  page(pageName, properties = {}) {
    if (!this.enabled) return;

    const pageData = {
      page: pageName,
      url: window.location.href,
      referrer: document.referrer,
      ...properties
    };

    this.track('Page View', pageData);
  }

  // Track video chat specific events
  videoChat = {
    // Connection events
    connectionStarted: (roomId) => {
      this.track('Video Chat Started', { room_id: roomId, category: 'video_chat' });
    },

    connectionSuccessful: (roomId, duration) => {
      this.track('Video Chat Connected', { 
        room_id: roomId, 
        connection_duration_ms: duration,
        category: 'video_chat' 
      });
    },

    connectionFailed: (roomId, error) => {
      this.track('Video Chat Failed', { 
        room_id: roomId, 
        error_type: error.type,
        error_message: error.message,
        category: 'video_chat' 
      });
    },

    // User interactions
    userJoined: (roomId, userCount) => {
      this.track('User Joined Room', { 
        room_id: roomId, 
        user_count: userCount,
        category: 'video_chat' 
      });
    },

    userLeft: (roomId, sessionDuration) => {
      this.track('User Left Room', { 
        room_id: roomId, 
        session_duration_seconds: sessionDuration,
        category: 'video_chat' 
      });
    },

    // Feature usage
    screenShareStarted: (roomId) => {
      this.track('Screen Share Started', { room_id: roomId, category: 'features' });
    },

    chatMessageSent: (roomId, messageLength) => {
      this.track('Chat Message Sent', { 
        room_id: roomId, 
        message_length: messageLength,
        category: 'features' 
      });
    },

    reactionSent: (roomId, reactionType) => {
      this.track('Reaction Sent', { 
        room_id: roomId, 
        reaction_type: reactionType,
        category: 'features' 
      });
    }
  };

  // Track performance metrics
  performance = {
    // Page load metrics
    pageLoad: (loadTime) => {
      this.track('Page Load Performance', {
        load_time_ms: loadTime,
        category: 'performance'
      });
    },

    // Video call quality
    callQuality: (roomId, metrics) => {
      this.track('Call Quality Metrics', {
        room_id: roomId,
        video_resolution: metrics.videoResolution,
        fps: metrics.fps,
        bitrate: metrics.bitrate,
        packet_loss: metrics.packetLoss,
        jitter: metrics.jitter,
        category: 'performance'
      });
    },

    // Connection latency
    connectionLatency: (latency) => {
      this.track('Connection Latency', {
        latency_ms: latency,
        category: 'performance'
      });
    }
  };

  // Privacy-compliant user segmentation
  segment = {
    // User behavior segments
    setUserSegment: (segment) => {
      if (!this.enabled) return;
      
      if (MIXPANEL_TOKEN) {
        mixpanel.people.set({ user_segment: segment });
      }
    },

    // Feature adoption tracking
    featureAdoption: (featureName, adopted) => {
      this.track('Feature Adoption', {
        feature_name: featureName,
        adopted: adopted,
        category: 'product'
      });
    }
  };
}

// Create singleton instance
const analytics = new Analytics();

// Export for use in components
export default analytics;

// React hook for analytics
export const useAnalytics = () => {
  const trackEvent = (eventName, properties) => analytics.track(eventName, properties);
  const trackPage = (pageName, properties) => analytics.page(pageName, properties);
  const identifyUser = (userId, traits) => analytics.identify(userId, traits);

  return {
    track: trackEvent,
    page: trackPage,
    identify: identifyUser,
    videoChat: analytics.videoChat,
    performance: analytics.performance,
    segment: analytics.segment
  };
};