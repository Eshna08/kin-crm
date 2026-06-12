import { redirect } from 'next/navigation';

// The campaign detail / live feed is shown inline on the Campaigns page.
export default function CampaignDetail() {
  redirect('/campaigns');
}
