// The main page component for the "Learn" section, which imports and renders the LearnClient component. 
import { get } from "http";
import LearnClient from "./learn-client";

export default async function LearnPage() { 

  return (
    <LearnClient
    /> 
  );
}