import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon } from './icons';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  loading?: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({ onSubmit, loading }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="form-control flex-1">
          <input
            type="url"
            placeholder={t('urlInput.placeholder')}
            className="input input-bordered w-full bg-base-200"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          className={`btn btn-primary ${loading ? 'loading' : ''}`}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <SearchIcon className="w-4 h-4" />
          )}
          {loading ? t('urlInput.loading') : t('urlInput.button')}
        </button>
      </form>
    </div>
  );
};
