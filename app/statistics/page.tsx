// The main page component for the "Statistics" section, which fetches all necessary data on the server side and 
// then renders the OverviewClient component with that data. 

import OverviewClient from "./statistics-client";
import { getAllMetabolicDataGrouped, getNationalTrend, getEthnicityData } from "@/lib/queries";

export default async function StatisticsPage() {
  const [{ dataByYear, availableYears }, nationalTrend, ethnicityData] = await Promise.all([
    getAllMetabolicDataGrouped(),
    getNationalTrend(),
    getEthnicityData(),
  ]); 

  return (
    <OverviewClient  
      dataByYear={dataByYear}
      availableYears={availableYears} 
      nationalTrend={nationalTrend}
      ethnicityData={ethnicityData}
    /> 
  );
}
