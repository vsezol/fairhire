import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UrlInput } from '../components/UrlInput';
import { SessionsList } from '../components/SessionsList';
import { ActivitiesList } from '../components/ActivitiesList';
import { MouseTracker } from '../components/MouseTracker';
import { useSessions } from '../hooks/useSessions';
import { useActivities } from '../hooks/useActivities';
import { GlobeIcon } from '../components/icons';

export function App() {
  const { i18n } = useTranslation();
  const [callUrl, setCallUrl] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );

  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
  } = useSessions(callUrl);

  const {
    activities,
    loading: activitiesLoading,
    error: activitiesError,
  } = useActivities(selectedSessionId);

  // Находим выбранную сессию
  const selectedSession = sessions.find(
    (session) => session.session_id === selectedSessionId
  );

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ru' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleUrlSubmit = (url: string) => {
    setCallUrl(url);
    setSelectedSessionId(null); // Reset selected session when new URL is submitted
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  return (
    <div className="min-h-screen bg-base-100" data-theme="dark">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">FairHire Interview</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="btn btn-ghost btn-sm gap-2"
            >
              <GlobeIcon className="w-4 h-4" />
              {i18n.language.toUpperCase()}
            </button>
          </div>
        </div>

        {/* URL Input */}
        <div className="mb-8">
          <UrlInput onSubmit={handleUrlSubmit} loading={sessionsLoading} />
        </div>

        {/* Sessions List */}
        {callUrl && (
          <div className="mb-8">
            <SessionsList
              sessions={sessions}
              loading={sessionsLoading}
              error={sessionsError}
              selectedSessionId={selectedSessionId}
              onSessionSelect={handleSessionSelect}
            />
          </div>
        )}

        {/* Activities and Mouse Tracking */}
        {selectedSessionId && (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:max-w-96">
              <ActivitiesList
                activities={activities}
                loading={activitiesLoading}
                error={activitiesError}
              />
            </div>
            <div className="lg:w-100">
              <MouseTracker activities={activities} session={selectedSession} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
