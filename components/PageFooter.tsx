import Link from 'next/link';
import Icon from './Icon';
import Feedback from './Feedback';
import type { PagerLink } from '@/lib/content';

export default function PageFooter({
  site,
  slug,
  pager,
  feedback,
}: {
  site: string;
  slug: string;
  pager: { prev: PagerLink | null; next: PagerLink | null };
  feedback: boolean;
}) {
  return (
    <footer className="page-footer">
      {feedback && <Feedback slug={`${site}/${slug}`} />}
      <div className="pager">
        {pager.prev ? (
          <Link href={`/${site}/${pager.prev.slug}`} className="pager-link prev">
            <Icon name="chevron-right" size={14} className="flip" />
            <div>
              <span>Previous</span>
              <strong>{pager.prev.title}</strong>
            </div>
          </Link>
        ) : (
          <span />
        )}
        {pager.next ? (
          <Link href={`/${site}/${pager.next.slug}`} className="pager-link next">
            <div>
              <span>Next</span>
              <strong>{pager.next.title}</strong>
            </div>
            <Icon name="chevron-right" size={14} />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </footer>
  );
}
