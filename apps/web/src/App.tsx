import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RoleRoute } from './components/RoleRoute';
import { Admin } from './pages/Admin';
import { Demo } from './pages/Demo';
import { Impact } from './pages/Impact';
import { Investor } from './pages/Investor';
import { Offering } from './pages/Offering';
import { Transaction } from './pages/Transaction';
import { Treasury } from './pages/Treasury';
import { Verifier } from './pages/Verifier';

export function App() {
  return <Routes><Route element={<Layout />}><Route element={<Navigate replace to="/demo" />} index /><Route element={<Demo />} path="demo" /><Route element={<RoleRoute path="/issuer/offerings"><Offering /></RoleRoute>} path="issuer/offerings" /><Route element={<RoleRoute path="/issuer/treasury"><Treasury /></RoleRoute>} path="issuer/treasury" /><Route element={<RoleRoute path="/verifier"><Verifier /></RoleRoute>} path="verifier" /><Route element={<RoleRoute path="/investor"><Investor /></RoleRoute>} path="investor" /><Route element={<Impact />} path="impact" /><Route element={<RoleRoute path="/admin"><Admin /></RoleRoute>} path="admin" /><Route element={<Transaction />} path="transactions/:hash" /><Route element={<Navigate replace to="/demo" />} path="*" /></Route></Routes>;
}
