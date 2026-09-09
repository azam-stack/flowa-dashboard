import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import TodayPage from "@/pages/TodayPage";
import OwnSalesPage from "@/pages/OwnSalesPage";
import DeliveryPage from "@/pages/DeliveryPage";
import DeliveryClientPage from "@/pages/DeliveryClientPage";
import MeetingQualityPage from "@/pages/MeetingQualityPage";
import CampaignsPage from "@/pages/CampaignsPage";
import CampaignDetailPage from "@/pages/CampaignDetailPage";
import InfrastructurePage from "@/pages/InfrastructurePage";
import EconomyPage from "@/pages/EconomyPage";
import CapacityPage from "@/pages/CapacityPage";
import TasksPage from "@/pages/TasksPage";
import WeeklyReviewPage from "@/pages/WeeklyReviewPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/eget-salg" element={<OwnSalesPage />} />
        <Route path="/levering" element={<DeliveryPage />} />
        <Route path="/levering/:clientId" element={<DeliveryClientPage />} />
        <Route path="/mødekvalitet" element={<MeetingQualityPage />} />
        <Route path="/kampagner" element={<CampaignsPage />} />
        <Route path="/kampagner/:campaignId" element={<CampaignDetailPage />} />
        <Route path="/infrastruktur" element={<InfrastructurePage />} />
        <Route path="/økonomi" element={<EconomyPage />} />
        <Route path="/kapacitet" element={<CapacityPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/ugentlig-gennemgang" element={<WeeklyReviewPage />} />
      </Route>
    </Routes>
  );
}
