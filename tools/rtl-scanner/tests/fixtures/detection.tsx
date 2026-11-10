import { createTheme, ThemeProvider, TextField, TableCell, Pagination } from '@mui/material';
import ArrowForward from '@mui/icons-material/ArrowForward';
import styled from '@emotion/styled';
export const theme = createTheme({ direction: 'ltr' });
export const Drawer = styled.aside`position: fixed; left: 0; width: 200px; transform: translateX(-100%);`;
export function activate() { document.documentElement.dir = 'rtl'; }
export function View() {
 return <ThemeProvider theme={theme}><div className="logo"><span>x</span>acme<span>.</span></div><div><svg><path d="M0 0 L100 10"/></svg><div className="months"><span>Jan</span><span>Feb</span></div></div><TextField/><TableCell>Header</TableCell><Pagination/><ArrowForward/>{String('Next →')}</ThemeProvider>;
}
