import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Page } from '../../types';

type PageLinkProps = {
  pageId: string;
  className?: string;
};

const PageLink: React.FC<PageLinkProps> = ({ pageId, className = '' }) => {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('pages')
          .select('id, title, type')
          .eq('id', pageId)
          .single();
        
        if (error) throw error;
        
        setPage(data as Page);
      } catch (error: any) {
        console.error('Error fetching linked page:', error);
        setError(error.message || 'Failed to fetch page');
      } finally {
        setLoading(false);
      }
    };
    
    if (pageId) {
      fetchPage();
    }
  }, [pageId]);
  
  if (loading) {
    return <span className="text-slate-400">Loading link...</span>;
  }
  
  if (error || !page) {
    return <span className="text-red-500">Failed to load link</span>;
  }
  
  return (
    <Link
      to={`/page/${page.id}`}
      className={`inline-flex items-center gap-1 text-blue-600 hover:underline ${className}`}
    >
      {page.title} <ExternalLink size={14} className="inline" />
    </Link>
  );
};

export default PageLink;