import styled from '@emotion/styled';
import { Box } from '@mui/material';
const Frame = styled.div`padding: 2px 4px;`;
export function Sample() {
  return <Frame><Box sx={{ ml: 2, padding: { xs: 1, md: 3 } }} style={{ marginLeft: 2 }} /></Frame>;
}
